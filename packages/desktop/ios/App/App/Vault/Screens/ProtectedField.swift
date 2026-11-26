import SwiftUI
import UIKit

@available(iOS 17.0, *)
struct ProtectedField: UIViewRepresentable {
    private let label: String
    @Binding private var text: String
    private let secure: Bool

    init(_ label: String, text: Binding<String>, secure: Bool = false) {
        self.label = label
        self._text = text
        self.secure = secure
    }

    func makeUIView(context: Context) -> UITextField {
        let field = NoCopyTextField()
        field.placeholder = label
        field.accessibilityLabel = label
        field.isSecureTextEntry = secure
        field.font = .preferredFont(forTextStyle: .body)
        field.adjustsFontForContentSizeCategory = true
        field.autocapitalizationType = .none
        field.autocorrectionType = .no
        field.spellCheckingType = .no
        field.returnKeyType = .done
        field.delegate = context.coordinator
        field.smartDashesType = .no
        field.smartQuotesType = .no
        field.smartInsertDeleteType = .no
        field.setContentHuggingPriority(.defaultLow, for: .horizontal)
        field.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        field.addTarget(context.coordinator, action: #selector(Coordinator.changed(_:)), for: .editingChanged)
        return field
    }

    func updateUIView(_ field: UITextField, context: Context) {
        if field.text != text { field.text = text }
        field.isEnabled = context.environment.isEnabled
    }

    func makeCoordinator() -> Coordinator { Coordinator(text: $text) }

    @MainActor
    final class Coordinator: NSObject, UITextFieldDelegate {
        @Binding var text: String

        init(text: Binding<String>) { self._text = text }

        func textFieldShouldReturn(_ textField: UITextField) -> Bool {
            textField.resignFirstResponder()
            return true
        }

        @objc func changed(_ field: UITextField) { text = field.text ?? "" }
    }

    private final class NoCopyTextField: UITextField {
        override func canPerformAction(_ action: Selector, withSender sender: Any?) -> Bool {
            guard action == #selector(UIResponderStandardEditActions.paste(_:))
                    || action == #selector(UIResponderStandardEditActions.select(_:))
                    || action == #selector(UIResponderStandardEditActions.selectAll(_:))
                    || action == #selector(UIResponderStandardEditActions.delete(_:)) else { return false }
            return super.canPerformAction(action, withSender: sender)
        }

        override func copy(_ sender: Any?) {}
        override func cut(_ sender: Any?) {}
    }
}
