import Foundation

public enum CodecError: Error {
    case packetTooShort
    case payloadTruncated
    case invalidPacketType
}

/**
 * Encode a MeshPacket into a binary frame (Big-Endian).
 */
public func encodePacket(_ packet: MeshPacket) -> Data {
    var data = Data()
    
    data.append(packet.version)
    data.append(packet.type.rawValue)
    
    // Packet ID (8 bytes)
    data.append(packet.packetId.prefix(8))
    
    // Source & Dest NodeIDs (16 bytes each)
    data.append(packet.src.prefix(16))
    data.append(packet.dst.prefix(16))
    
    data.append(packet.ttl)
    data.append(packet.hopCount)
    
    // Timestamp (UInt32 big-endian)
    var timestampBE = packet.timestamp.bigEndian
    withUnsafeBytes(of: &timestampBE) { data.append(contentsOf: $0) }
    
    // Payload length (UInt16 big-endian)
    var lengthBE = UInt16(packet.payload.count).bigEndian
    withUnsafeBytes(of: &lengthBE) { data.append(contentsOf: $0) }
    
    // Payload
    data.append(packet.payload)
    
    // Signature (if present)
    if let sig = packet.signature {
        data.append(sig)
    }
    
    return data
}

/**
 * Decode a binary frame into a MeshPacket.
 */
public func decodePacket(_ data: Data) throws -> MeshPacket {
    guard data.count >= MeshPacket.headerSize else {
        throw CodecError.packetTooShort
    }
    
    let version = data[0]
    
    guard let type = PacketType(rawValue: data[1]) else {
        throw CodecError.invalidPacketType
    }
    
    let packetId = data.subdata(in: 2..<10)
    let src = data.subdata(in: 10..<26)
    let dst = data.subdata(in: 26..<42)
    
    let ttl = data[42]
    let hopCount = data[43]
    
    // Read timestamp
    let timestampBE: UInt32 = data.subdata(in: 44..<48).withUnsafeBytes {
        $0.load(as: UInt32.self)
    }
    let timestamp = UInt32(bigEndian: timestampBE)
    
    // Read payload length
    let lengthBE: UInt16 = data.subdata(in: 48..<50).withUnsafeBytes {
        $0.load(as: UInt16.self)
    }
    let payloadLength = Int(UInt16(bigEndian: lengthBE))
    
    guard data.count >= MeshPacket.headerSize + payloadLength else {
        throw CodecError.payloadTruncated
    }
    
    let payload = data.subdata(in: MeshPacket.headerSize..<(MeshPacket.headerSize + payloadLength))
    
    var signature: Data? = nil
    let signatureStart = MeshPacket.headerSize + payloadLength
    if data.count > signatureStart {
        signature = data.subdata(in: signatureStart..<data.count)
    }
    
    return MeshPacket(
        version: version,
        type: type,
        packetId: packetId,
        src: src,
        dst: dst,
        ttl: ttl,
        hopCount: hopCount,
        timestamp: timestamp,
        payload: payload,
        signature: signature
    )
}

/**
 * Constant-time data comparison for security.
 */
public func constantTimeEquals(_ a: Data, _ b: Data) -> Bool {
    guard a.count == b.count else { return false }
    var diff: UInt8 = 0
    for i in 0..<a.count {
        diff |= a[i] ^ b[i]
    }
    return diff == 0
}
