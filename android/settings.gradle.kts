pluginManagement {
    repositories {
        google()
        mavenCentral()
        gradlePluginPortal()
    }
}

dependencyResolution {
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "MeshMessenger"
include(":app")
include(":core")
include(":transport-ble")
include(":transport-wifi")
include(":transport-relay")
include(":data")
