import Foundation
import CoreBluetooth
import MeshCore

public protocol BLEPeripheralDelegate: AnyObject {
    func blePeripheral(_ peripheral: BLEPeripheral, didReceiveData data: Data, from peer: NodeId)
}

public class BLEPeripheral: NSObject, CBPeripheralManagerDelegate {
    private var manager: CBPeripheralManager!
    private let ownNodeId: NodeId
    private let serviceUUID: CBUUID
    
    private var rxChar: CBMutableCharacteristic?
    private var txChar: CBMutableCharacteristic?
    
    public weak var delegate: BLEPeripheralDelegate?
    
    public init(ownNodeId: NodeId, serviceUUID: UUID) {
        self.ownNodeId = ownNodeId
        self.serviceUUID = CBUUID(nsuuid: serviceUUID)
        super.init()
        
        // State restoration config matching iOS skill spec rules
        self.manager = CBPeripheralManager(
            delegate: self,
            queue: nil,
            options: [CBPeripheralManagerOptionRestoreIdentifierKey: "MeshPeripheralRestoreID"]
        )
    }
    
    public func startAdvertising() {
        guard manager.state == .poweredOn else { return }
        
        let advertisement: [String: Any] = [
            CBAdvertisementDataServiceUUIDsKey: [serviceUUID],
            CBAdvertisementDataLocalNameKey: "MeshNode-\(ownNodeId.shortId())"
        ]
        manager.startAdvertising(advertisement)
    }
    
    public func stopAdvertising() {
        manager.stopAdvertising()
    }
    
    // ── CBPeripheralManagerDelegate ────────────────────────────────────────
    
    public func peripheralManagerDidUpdateState(_ peripheral: CBPeripheralManager) {
        if peripheral.state == .poweredOn {
            setupServices()
            startAdvertising()
        }
    }
    
    public func peripheralManager(_ peripheral: CBPeripheralManager, willRestoreState dict: [String : Any]) {
        // App woke up in background, restore state here
    }
    
    private func setupServices() {
        let service = CBMutableService(type: serviceUUID, primary: true)
        
        // Central writes to this TX char
        txChar = CBMutableCharacteristic(
            type: CBUUID(string: "7a3d5e8c-1f2b-4c6a-9d0e-8b4f2a1c3d5f"),
            properties: [.writeWithoutResponse, .write],
            value: nil,
            permissions: [.writeable]
        )
        
        // Central subscribes to this RX char to get notifications
        rxChar = CBMutableCharacteristic(
            type: CBUUID(string: "7a3d5e8c-1f2b-4c6a-9d0e-8b4f2a1c3d60"),
            properties: [.notify],
            value: nil,
            permissions: [.readable]
        )
        
        service.characteristics = [txChar!, rxChar!]
        manager.add(service)
    }
    
    public func peripheralManager(_ peripheral: CBPeripheralManager, didReceiveWrite requests: [CBATTRequest]) {
        for request in requests {
            if request.characteristic.uuid == txChar?.uuid, let data = request.value {
                // In full implementation, decode node handshake from payload
                delegate?.blePeripheral(self, didReceiveData: data, from: ownNodeId)
            }
            peripheral.respond(to: request, withResult: .success)
        }
    }
}
