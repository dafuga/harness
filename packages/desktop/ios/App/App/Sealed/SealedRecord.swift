import Foundation

/// The clear, authenticated header of a record: which scope, epoch, object and revision.
struct SealedRecordHeader: Equatable {
    let scopeId: Data
    let epoch: UInt32
    let objectId: Data
    let revision: UInt64

    var bytes: Data {
        Data([1]) + scopeId + SealedBytes.u32(epoch) + objectId + SealedBytes.u64(revision)
    }
}

/// Which object a record writes and which revision of it.
struct SealedObjectRef {
    let objectId: Data
    let revision: UInt64
}

/// The salt and nonce of one record: fresh each time unless a check pins them to a vector.
struct SealedRecordRandom {
    let salt: Data
    let nonce: Data
    static var fresh: SealedRecordRandom {
        SealedRecordRandom(salt: RemoteCoding.random(16), nonce: RemoteCoding.random(12))
    }
}

/// A sealed v1 record: 0x01 ‖ scope id 16 ‖ epoch u32 ‖ object id 32 ‖ revision u64 ‖ salt 16 ‖
/// nonce 12 ‖ AES-256-GCM, with the whole prefix authenticated and a per-object HKDF key.
enum SealedRecord {
    private static let headerLength = 61
    private static let prefixLength = headerLength + 16 + 12
    private static let info = "harness/sealed/v1/record"

    /// Reads the header so a client can pick its keys. The contents stay sealed.
    static func header(_ envelope: Data) throws -> SealedRecordHeader {
        guard envelope.count >= prefixLength + 16, envelope[envelope.startIndex] == 1 else {
            throw SealedError("Not a sealed v1 record.")
        }
        let start = envelope.startIndex
        return SealedRecordHeader(
            scopeId: envelope.subdata(in: (start + 1)..<(start + 17)),
            epoch: SealedBytes.readU32(envelope, at: 17),
            objectId: envelope.subdata(in: (start + 21)..<(start + 53)),
            revision: SealedBytes.readU64(envelope, at: 53))
    }

    /// Seals JSON bytes under the scope's current keys with a per-object key and nonce.
    static func seal(
        _ json: Data, keys: SealedScopeKeys, object: SealedObjectRef,
        random: SealedRecordRandom = .fresh
    ) throws -> Data {
        guard object.objectId.count == 32 else { throw SealedError("Record object id must be 32 bytes.") }
        let header = SealedRecordHeader(
            scopeId: keys.scopeId, epoch: keys.epoch, objectId: object.objectId,
            revision: object.revision)
        let prefix = header.bytes + random.salt + random.nonce
        let key = SealedBytes.derive(keys.dataKey, salt: random.salt, info: info)
        let sealed = try SealedBytes.seal(
            SealedPadding.pad(json), key: key, nonce: random.nonce, aad: prefix)
        return prefix + sealed
    }

    /// Opens an envelope sealed for these keys. Any changed byte, or other keys, throws.
    static func open(_ envelope: Data, keys: SealedScopeKeys) throws -> (
        header: SealedRecordHeader, json: Data
    ) {
        let header = try header(envelope)
        guard header.scopeId == keys.scopeId, header.epoch == keys.epoch else {
            throw SealedError("Record belongs to other scope keys.")
        }
        let start = envelope.startIndex
        let prefix = envelope.subdata(in: start..<(start + prefixLength))
        let salt = envelope.subdata(in: (start + headerLength)..<(start + headerLength + 16))
        let nonce = envelope.subdata(in: (start + headerLength + 16)..<(start + prefixLength))
        let key = SealedBytes.derive(keys.dataKey, salt: salt, info: info)
        do {
            let plain = try SealedBytes.open(
                envelope.subdata(in: (start + prefixLength)..<envelope.endIndex), key: key,
                nonce: nonce, aad: prefix)
            return (header, try SealedPadding.unpad(plain))
        } catch let error as SealedError {
            throw error
        } catch {
            throw SealedError("Record failed authentication.")
        }
    }
}
