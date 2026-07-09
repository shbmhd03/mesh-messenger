import SwiftUI
import DataStore

// Theme Colors mapping the WebApp CSS design system
struct ThemeColors {
    static let bgBase = Color(red: 0.02, green: 0.02, blue: 0.04)
    static let bgSurface = Color(red: 0.05, green: 0.05, blue: 0.08)
    static let accent = Color(red: 0.42, green: 0.31, blue: 1.0)
    static let success = Color(red: 0.0, green: 0.78, blue: 0.33)
    static let textPrimary = Color(white: 0.92)
    static let textSecondary = Color(white: 0.55)
}

struct ChatView: View {
    let contactName: String
    let hopCount: Int
    let transport: String
    
    @ObservedObject var service: MeshService
    @State private var textState = ""
    
    var body: some View {
        VStack(spacing: 0) {
            // Top Header Bar
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text(contactName)
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(ThemeColors.textPrimary)
                    
                    HStack(spacing: 6) {
                        Circle()
                            .fill(ThemeColors.success)
                            .frame(width: 6, height: 6)
                        
                        Text(hopCount == 0 ? "Direct via \(transport.uppercased())" : "\(hopCount) hops via \(transport.uppercased())")
                            .font(.system(size: 11))
                            .foregroundColor(ThemeColors.textSecondary)
                    }
                }
                Spacer()
                
                Button(action: {}) {
                    Image(systemName: "shield.fill")
                        .foregroundColor(ThemeColors.textSecondary)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 12)
            .background(ThemeColors.bgSurface)
            
            // Message List
            ScrollView {
                VStack(spacing: 8) {
                    Text("🔒 Messages are end-to-end encrypted")
                        .font(.system(size: 11))
                        .foregroundColor(ThemeColors.textSecondary)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 6)
                        .background(ThemeColors.bgSurface)
                        .cornerRadius(12)
                        .padding(.vertical, 12)
                    
                    ForEach(service.messages, id: \.id) { msg in
                        MessageBubbleView(message: msg)
                    }
                }
                .padding(.horizontal, 16)
            }
            .background(ThemeColors.bgBase)
            
            // Bottom Message Composer
            HStack(spacing: 8) {
                TextField("", text: $textState, prompt: Text("Type a message...").foregroundColor(ThemeColors.textSecondary))
                    .padding(12)
                    .background(ThemeColors.bgBase)
                    .foregroundColor(ThemeColors.textPrimary)
                    .cornerRadius(20)
                    .font(.system(size: 14))
                
                Button(action: {
                    if !textState.isEmpty {
                        service.sendChatMessage(textState, convoId: "conv1")
                        textState = ""
                    }
                }) {
                    Image(systemName: "paperplane.fill")
                        .font(.system(size: 16, weight: .bold))
                        .foregroundColor(.white)
                        .frame(width: 44, height: 44)
                        .background(ThemeColors.accent)
                        .clipShape(Circle())
                }
                .disabled(textState.isEmpty)
            }
            .padding(12)
            .background(ThemeColors.bgSurface)
        }
        .background(ThemeColors.bgBase)
    }
}

struct MessageBubbleView: View {
    let message: MessageRecord
    
    var body: some View {
        let alignment: Alignment = message.isSent ? .trailing : .leading
        let bubbleColor = message.isSent ? ThemeColors.accent : ThemeColors.bgSurface
        
        VStack(alignment: message.isSent ? .trailing : .leading, spacing: 2) {
            Text(String(data: message.ciphertext, encoding: .utf8) ?? "")
                .font(.system(size: 14))
                .foregroundColor(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(bubbleColor)
                .cornerRadius(16)
                .frame(maxWidth: 260, alignment: alignment)
            
            HStack(spacing: 4) {
                Text(formatTime(message.timestamp))
                    .font(.system(size: 10))
                    .foregroundColor(ThemeColors.textSecondary)
                
                if message.isSent {
                    Text(statusSymbol(message.status))
                        .font(.system(size: 10, weight: .bold))
                        .foregroundColor(message.status == "read" ? ThemeColors.success : ThemeColors.textSecondary)
                }
            }
            .padding(.horizontal, 4)
        }
        .frame(maxWidth: .infinity, alignment: alignment)
    }
    
    private func formatTime(_ timestamp: Int64) -> String {
        let formatter = DateFormatter()
        formatter.dateFormat = "hh:mm a"
        return formatter.string(from: Date(timeIntervalSince1970: TimeInterval(timestamp / 1000)))
    }
    
    private func statusSymbol(_ status: String) -> String {
        switch status {
        case "pending": return "◷"
        case "sent": return "✓"
        case "delivered": return "✓✓"
        case "read": return "✓✓"
        default: return "✕"
        }
    }
}
