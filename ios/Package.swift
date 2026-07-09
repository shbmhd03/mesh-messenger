// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "MeshMessenger",
    platforms: [
        .iOS(.v16)
    ],
    products: [
        .library(name: "MeshCore", targets: ["MeshCore"]),
        .library(name: "DataStore", targets: ["DataStore"]),
        .library(name: "TransportBLE", targets: ["TransportBLE"]),
        .library(name: "TransportMultipeer", targets: ["TransportMultipeer"]),
        .library(name: "TransportRelay", targets: ["TransportRelay"])
    ],
    dependencies: [
        // GRDB + SQLCipher for secure iOS storage
        .package(url: "https://github.com/groue/GRDB.swift.git", from: "6.24.0")
    ],
    targets: [
        .target(
            name: "MeshCore",
            dependencies: []
        ),
        .target(
            name: "DataStore",
            dependencies: [
                .product(name: "GRDB", package: "GRDB.swift"),
                "MeshCore"
            ]
        ),
        .target(
            name: "TransportBLE",
            dependencies: ["MeshCore"]
        ),
        .target(
            name: "TransportMultipeer",
            dependencies: ["MeshCore"]
        ),
        .target(
            name: "TransportRelay",
            dependencies: ["MeshCore"]
        ),
        .testTarget(
            name: "MeshCoreTests",
            dependencies: ["MeshCore"]
        )
    ]
)
