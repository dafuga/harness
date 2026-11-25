import Foundation

/// A JSON value the chain signs. Numbers are integers, as in every signed object.
indirect enum SealedJson: Equatable {
    case null
    case bool(Bool)
    case int(Int64)
    case string(String)
    case array([SealedJson])
    case object([String: SealedJson])

    /// Sorted keys, no spaces, `JSON.stringify` escapes: the bytes TypeScript signs and hashes.
    var canonical: String {
        switch self {
        case .null: return "null"
        case .bool(let value): return value ? "true" : "false"
        case .int(let value): return String(value)
        case .string(let value): return SealedJson.quote(value)
        case .array(let items): return "[" + items.map(\.canonical).joined(separator: ",") + "]"
        case .object(let fields):
            let keys = fields.keys.sorted { $0.utf16.lexicographicallyPrecedes($1.utf16) }
            return "{" + keys.map { SealedJson.quote($0) + ":" + fields[$0]!.canonical }
                .joined(separator: ",") + "}"
        }
    }

    private static func quote(_ text: String) -> String {
        var out = "\""
        for scalar in text.unicodeScalars {
            switch scalar {
            case "\"": out += "\\\""
            case "\\": out += "\\\\"
            case "\u{08}": out += "\\b"
            case "\u{0C}": out += "\\f"
            case "\n": out += "\\n"
            case "\r": out += "\\r"
            case "\t": out += "\\t"
            case _ where scalar.value < 0x20: out += String(format: "\\u%04x", scalar.value)
            default: out.unicodeScalars.append(scalar)
            }
        }
        return out + "\""
    }

    /// Reads a Foundation JSON value. A fraction or an exponent is refused: nothing signed has one.
    static func from(_ value: Any) throws -> SealedJson {
        switch value {
        case is NSNull: return .null
        case let number as NSNumber: return try scalar(number)
        case let text as String: return .string(text)
        case let items as [Any]: return .array(try items.map(from))
        case let fields as [String: Any]: return .object(try fields.mapValues(from))
        default: throw SealedError("Unsupported JSON value.")
        }
    }

    private static func scalar(_ number: NSNumber) throws -> SealedJson {
        if CFGetTypeID(number) == CFBooleanGetTypeID() { return .bool(number.boolValue) }
        guard !CFNumberIsFloatType(number) else { throw SealedError("Signed JSON holds no fractions.") }
        return .int(number.int64Value)
    }

    static func parse(_ data: Data) throws -> SealedJson {
        try from(JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]))
    }

    subscript(key: String) -> SealedJson? {
        if case .object(let fields) = self { return fields[key] }
        return nil
    }

    var text: String? {
        if case .string(let value) = self { return value }
        return nil
    }

    var number: Int64? {
        if case .int(let value) = self { return value }
        return nil
    }

    var items: [SealedJson]? {
        if case .array(let values) = self { return values }
        return nil
    }
}
