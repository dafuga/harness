import CryptoKit
import Foundation

/// The clear header of a live stream frame.
struct SealedFrameHeader: Equatable {
    let scopeId: Data
    let epoch: UInt32
    let streamId: Data
    let counter: UInt64

    var bytes: Data {
        Data([2]) + scopeId + SealedBytes.u32(epoch) + streamId + SealedBytes.u64(counter)
    }
}

/// One session stream: its id and its AES key, derived once and used for every frame.
struct SealedStream {
    let id: Data
    let key: SymmetricKey

    /// HKDF(dataKey, salt = stream id): one AES-256-GCM key per stream.
    init(keys: SealedScopeKeys, id: Data) throws {
        guard id.count == 16 else { throw SealedError("Stream id must be 16 bytes.") }
        self.id = id
        key = SealedBytes.derive(keys.dataKey, salt: id, info: "harness/sealed/v1/stream")
    }
}

/// A sealed v1 stream frame: 0x02 ‖ scope id ‖ epoch ‖ stream id ‖ counter u64 ‖ AES-256-GCM.
/// The nonce is 4 zero bytes ‖ counter and the key is HKDF(dataKey, stream id), so a counter must
/// never repeat inside a stream.
enum SealedFrame {
    private static let headerLength = 45

    static func header(_ frame: Data) throws -> SealedFrameHeader {
        guard frame.count >= headerLength + 16, frame[frame.startIndex] == 2 else {
            throw SealedError("Not a sealed v1 stream frame.")
        }
        let start = frame.startIndex
        return SealedFrameHeader(
            scopeId: frame.subdata(in: (start + 1)..<(start + 17)),
            epoch: SealedBytes.readU32(frame, at: 17),
            streamId: frame.subdata(in: (start + 21)..<(start + 37)),
            counter: SealedBytes.readU64(frame, at: 37))
    }

    private static func nonce(_ counter: UInt64) -> Data { Data(count: 4) + SealedBytes.u64(counter) }

    static func seal(
        _ data: Data, keys: SealedScopeKeys, stream: SealedStream, counter: UInt64
    ) throws -> Data {
        let header = SealedFrameHeader(
            scopeId: keys.scopeId, epoch: keys.epoch, streamId: stream.id, counter: counter).bytes
        return header + (try SealedBytes.seal(data, key: stream.key, nonce: nonce(counter), aad: header))
    }

    static func open(_ frame: Data, keys: SealedScopeKeys, stream: SealedStream) throws -> (
        header: SealedFrameHeader, data: Data
    ) {
        let header = try header(frame)
        guard header.scopeId == keys.scopeId, header.epoch == keys.epoch else {
            throw SealedError("Frame belongs to other scope keys.")
        }
        let start = frame.startIndex
        let aad = frame.subdata(in: start..<(start + headerLength))
        do {
            let plain = try SealedBytes.open(
                frame.subdata(in: (start + headerLength)..<frame.endIndex), key: stream.key,
                nonce: nonce(header.counter), aad: aad)
            return (header, plain)
        } catch {
            throw SealedError("Frame failed authentication.")
        }
    }
}
