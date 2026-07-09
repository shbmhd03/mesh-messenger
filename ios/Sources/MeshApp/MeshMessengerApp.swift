import SwiftUI

@main
struct MeshMessengerApp: App {
    @StateObject private var service = MeshService()
    
    var body: some Scene {
        WindowGroup {
            ChatView(
                contactName: "Aisha Rahman",
                hopCount: 1,
                transport: "ble",
                service: service
            )
            .preferredColorScheme(.dark)
        }
    }
}
