import Foundation
import CoreBluetooth
import MeshCore

public protocol BLECentralDelegate: AnyObject {
    func bleCentral(_ central: BLECentral, didDiscoverPeer peerId: NodeId, rssi: Int)
    func bleCentral(_ central: BLECentral, didReceiveData data: Data, from peer: NodeId)
}

public class BLECentral: NSObject, CBCentralManagerDelegate, CBPeripheralDelegate {
    private var manager: CBCentralManager!
    private let ownNodeId: NodeId
    private let serviceUUID: CBUUID
    
    // Connected peripherals: hex(NodeID) -> Connected Peripheral info
    private var connectedPeripherals = [String: CBPeripheral]()
    
    public weak var delegate: BLECentralDelegate?
    
    public init(ownNodeId: NodeId, serviceUUID: UUID) {
        self.ownNodeId = ownNodeId
        self.serviceUUID = CBUUID(nsuuid: serviceUUID)
        super.init()
        
        self.manager = CBCentralManager(
            delegate: self,
            queue: nil,
            options: [CBCentralManagerOptionRestoreIdentifierKey: "MeshCentralRestoreID"]
        )
    }
    
    public func startScanning() {
        guard manager.state == .poweredOn else { return }
        
        // Scan specifically for service UUID to ensure background functionality
        manager.scanForPeripherals(
            withServices: [serviceUUID],
            options: [CBCentralManagerScanOptionAllowDuplicatesKey: false]
        )
    }
    
    public func stopScanning() {
        manager.stopScan()
    }
    
    // ── CBCentralManagerDelegate ───────────────────────────────────────────
    
    public func centralManagerDidUpdateState(_ central: CBCentralManager) {
        if central.state == .poweredOn {
            startScanning()
        }
    }
    
    public func centralManager(_ central: CBCentralManager, willRestoreState dict: [String : Any]) {
        // App woke up in background, restore state here
    }
    
    public func centralManager(
        _ central: CBCentralManager,
        didDiscover peripheral: CBPeripheral,
        advertisementData: [String : Any],
        rssi RSSI: NSNumber
    ) {
        // In full implementation, parse NodeID from advertisement handshake
        // Connect automatically if peer count within limits
        manager.connect(peripheral, options: nil)
    }
    
    public func centralManager(_ central: CBCentralManager, didConnect peripheral: CBPeripheral) {
        peripheral.delegate = self
        peripheral.discoverServices([serviceUUID])
    }
    
    // ── CBPeripheralDelegate ───────────────────────────────────────────────
    
    public func peripheral(_ peripheral: CBPeripheral, didDiscoverServices error: Error?) {
        guard let services = peripheral.services else { return }
        for service in services {
            if service.uuid == serviceUUID {
                peripheral.discoverCharacteristics(nil, for: service)
            }
        }
    }
    
    public func peripheral(_ peripheral: CBPeripheral, didDiscoverCharacteristicsFor service: CBService, error: Error?) {
        guard let chars = service.characteristics else { return }
        for char in chars {
            if char.uuid == CBUUID(string: "7a3d5e8c-1f2b-4c6a-9d0e-8b4f2a1c3d60") {
                // Subscribe to RX characteristic notifications
                peripheral.setNotifyValue(true, for: char)
            }
        }
    }
    
    public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBATTResult, error: Error?) {
        // In full implementation, invoke data received delegate
    }
    
    public func peripheral(_ peripheral: CBPeripheral, didUpdateValueFor characteristic: CBCharacteristic, error: Error?) {
        if let data = characteristic.value {
            delegate?.bleCentral(self, didReceiveData: data, from: ownNodeId)
        }
    }
}
