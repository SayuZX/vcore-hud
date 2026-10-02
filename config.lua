Config = {}

Config.Framework = 'qb'
Config.CoreResource = 'qb-core'
Config.Unit = 'MPH'
Config.UpdateInterval = 100
Config.LocationInterval = 750
Config.StatusInterval = 1000
Config.HideWhenPaused = true
Config.HideWhenDead = false
Config.HealthBase = 100
Config.OxygenSeconds = 10.0
Config.DefaultStatus = { hunger = 100, thirst = 100, stress = 0 }
Config.CompassSource = 'camera'
Config.AccountCommands = true
Config.Settings = { Enabled = true, Command = 'hudsettings', Key = 'I', UseMouse = false }
Config.Shortcuts = {
    Phone = { Enabled = true, Resource = 'qb-phone', Command = 'phone', Key = 'M' },
    Inventory = { Enabled = true, Resource = 'qb-inventory', Command = 'openInv', Key = 'TAB' },
    Music = { Enabled = true, Command = 'vcore-music', Key = '' }
}
Config.WeatherProvider = nil




Config.StatusProvider = nil


Config.FuelProvider = nil
Config.FuelAdapter = 'auto'
Config.FuelResource = nil
Config.FuelPollInterval = 1000


Config.FuelMode = 'auto'

Config.VoiceRange = 2
Config.VoiceAdapter = 'auto'
Config.VoiceResource = 'pma-voice'

Config.VoiceProvider = nil

Config.VoiceRangeProvider = nil

Config.Seatbelt = {
    Enabled = false,
    SourceResource = 'qb-smallresources',
    Provider = nil,
    Key = 'B',
    BlockExit = true,
    ExcludedClasses = { [8] = true, [13] = true, [14] = true, [15] = true, [16] = true, [21] = true }
}




Config.Stress = {
    Mode = 'internal',
    MaxEventAmount = 100,
    GainCooldown = 1000,
    ReliefCooldown = 1000,
    WhitelistedJobs = { leo = true, ambulance = true },
    Driving = {
        Enabled = true,
        Interval = 10000,
        Unit = 'MPH',
        Speed = 100,
        UnbuckledSpeed = 50,
        Amount = 1,
        DriverOnly = true,
        VehicleClasses = { [0]=true, [1]=true, [2]=true, [3]=true, [4]=true, [5]=true,
            [6]=true, [7]=true, [8]=true, [9]=true, [10]=true, [11]=true, [12]=true },
        WhitelistedModels = {}
    },
    Shooting = {
        Enabled = true,
        Chance = 0.10,
        SampleInterval = 1000,
        Amount = 1,
        WhitelistedWeapons = { weapon_petrolcan = true, weapon_hazardcan = true, weapon_fireextinguisher = true }
    },
    Effects = {
        Enabled = true,
        MinimumStress = 50,
        MinimumInterval = 15000,
        MaximumInterval = 60000,
        MinimumBlur = 1500,
        MaximumBlur = 3000
    }
}

Config.Radar = {
    Enabled = true,
    AlwaysVisible = false,
    CircularMask = true,
    HideVanillaBars = true,
    DisableExpandedMap = true,
    Zoom = 1100,

    ReferenceWidth = 1920,
    ReferenceHeight = 1080,
    MinScale = 0.5,
    MaxScale = 2,
    Right = 24,
    Top = 48,
    Diameter = 184,
    Inset = 2,


    OffsetX = 0,
    OffsetY = 0,
    ScaleX = 1.0,
    ScaleY = 1.0
}



Config.Preferences = {
    version = 5,
    moveMode = 'group',
    layout = 'rectangle', theme = 'dark', statusStyle = 'rings', speedStyle = 'auto',
    unit = Config.Unit, accent = '#70e1ca', scale = 1, blur = true, speedBackground = false,
    showIdentity = true, showMoney = true, showCash = true, showBank = true, showShortcuts = true,
    showVitals = true, showVehicle = true, showVoice = true, showMusic = true,
    showLocation = true, showMapTools = true,
    statusPlacement = 'standalone',
    identityShape = 'pill', moneyShape = 'pill', cashShape = 'pill', bankShape = 'pill', shortcutShape = 'circle',
    mapMode = Config.Radar.AlwaysVisible and 'always' or 'vehicle',
    elementPositions = {},
    elementOptions = {},
    positions = {


        radar = { x = 32, y = 24 }, vitals = { x = 32, y = 24 },
        vehicle = { x = 32, y = 24 }, identity = { x = 34, y = 28 },
        shortcuts = { x = 34, y = 72 }
    }
}



Config.HideComponents = { 3, 4, 6, 7, 8, 9 }
