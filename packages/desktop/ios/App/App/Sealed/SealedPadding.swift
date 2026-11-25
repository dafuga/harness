import Foundation

/// Hides exact sizes from the server: a big-endian u32 length, the bytes, then zeros up to the
/// next bucket (256 bytes doubling to 64 KiB, then 64 KiB steps).
enum SealedPadding {
    private static let smallest = 256
    private static let step = 64 * 1024

    static func bucket(for length: Int) -> Int {
        let needed = length + 4
        if needed > step { return (needed + step - 1) / step * step }
        var bucket = smallest
        while bucket < needed { bucket *= 2 }
        return bucket
    }

    static func pad(_ bytes: Data) -> Data {
        var padded = SealedBytes.u32(UInt32(bytes.count)) + bytes
        padded.append(Data(count: bucket(for: bytes.count) - padded.count))
        return padded
    }

    /// The original bytes. A length past the end or non-zero padding is refused.
    static func unpad(_ padded: Data) throws -> Data {
        guard padded.count >= 4 else { throw SealedError("Padded plaintext is too short.") }
        let length = Int(SealedBytes.readU32(padded, at: 0))
        guard length <= padded.count - 4 else { throw SealedError("Padded length is out of range.") }
        let start = padded.startIndex + 4
        guard padded[(start + length)...].allSatisfy({ $0 == 0 }) else {
            throw SealedError("Padding is not zero.")
        }
        return Data(padded[start..<(start + length)])
    }
}
