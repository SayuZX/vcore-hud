
Config.Aerial = {
    Enabled = true,
    DriverOnly = false,
    Jobs = nil,
    MinimumFov = 10.0, MaximumFov = 80.0, InitialFov = 50.0,
    PanSpeed = 70.0,
    MousePanSpeed = 8.0,
    ScanInterval = 500, ScanDistance = 400.0, ScanCandidates = 64, ReticleRadius = 0.10,
    SpotlightDistance = 250.0, SpotlightRadius = 15.0,
    MaximumSpotlightDistance = 500.0, MaximumSpotlightRadius = 50.0,
    ShowPlayerNames = false,
    MaskProvider = nil,
    JammerProvider = nil,
    JammerStateKey = 'veloxSignalJammer',
    NegativeTimecycle = nil,
    VisionProvider = nil
}

Config.Music = {
    Enabled = true,
    Adapter = 'cs-boombox',
    Resource = 'cs-boombox',
    BoomboxModel = 'prop_boombox_01',
    AllowYouTube = true,
    AllowedMedia = {},
    YouTubeAudio = {},
    DefaultVolume = 0.35, MaximumVolume = 1.0,
    MaximumPosition = 21600.0, PlaylistLimit = 32,
    RequestInterval = 200, SyncInterval = 3000, RequestTimeout = 5000,
    SessionLimit = 256, EmptyVehicleTimeout = 600000,
    Distance = 25.0, ClosedWindowVolume = 0.65,
    NearbyAudio = true,
    ListenerLimit = 32, ListenerMargin = 5.0,
    AmbientClientLimit = 16, AmbientTimeout = 8000,
    SyncWindowState = true,
    OcclusionProvider = nil
}

Config.Commands = {
    Enabled = true,
    MaximumText = 160,
    Cooldown = 350,
    SpeechAdapter = 'external',
    Wit = {
        ApiVersion = '20230215',
        MaximumEncodedBytes = 220000, MaximumAudioBytes = 160000,
        RateLimit = 6000, RequestTimeout = 20000, ClientTimeout = 27000,
        MaximumPending = 8, TransferBytesPerSecond = 100000
    },
    PhoneProvider = nil,
    InventoryProvider = nil,
    TranscriptProvider = nil
}
