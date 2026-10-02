
Config.VehicleControls = {
    Enabled = true,
    RoadClasses = { [0]=true,[1]=true,[2]=true,[3]=true,[4]=true,[5]=true,[6]=true,[7]=true,
        [8]=true,[9]=true,[10]=true,[11]=true,[12]=true,[17]=true,[18]=true,[19]=true,[20]=true },
    KeyResource = 'qb-vehiclekeys',
    RequireKeysForEngine = true,

    KeyProvider = nil,

    LockProvider = nil,
    EngineProvider = nil,
    LockCommand = 'togglelocks',
    SeatbeltCommand = 'toggleseatbelt',
    SeatbeltProvider = nil,
    Cruise = { Enabled=true, Resource='qb-smallresources', Command='togglecruise', MinimumSpeed=5.0, MaximumSpeed=120.0 },
    Limiter = { Enabled=true, MinimumSpeed=2.0, MaximumSpeed=120.0 },
    Manual = { Enabled=false },
    Modes = {
        Enabled=true,

        drift = { fTractionCurveMin=0.72, fTractionCurveMax=0.82,
            fLowSpeedTractionLossMult=1.30, fInitialDriveForce=1.05 },
        sport = { fInitialDriveForce=1.08, fBrakeForce=1.05 },
        sportplus = { fInitialDriveForce=1.16, fBrakeForce=1.10 }
    },
    Drift = { Enabled=true, MinimumSpeed=6.0, MinimumAngle=12.0,
        MaximumAngle=70.0, ComboDelay=2200, PointsPerSecond=10.0 },

    Commands = {
        engine={name='velox-engine',key=''}, lock={name='velox-lock',key=''},
        signalLeft={name='velox-signal-left',key=''}, signalRight={name='velox-signal-right',key=''},
        hazards={name='velox-hazards',key=''}, cruise={name='velox-cruise',key=''},
        limiter={name='velox-limiter',key=''}, manual={name='velox-manual',key=''},
        gearUp={name='velox-gear-up',key=''}, gearDown={name='velox-gear-down',key=''}
    }
}

Config.Nitro = {
    Enabled = false,
    Item = 'nitrous', InventoryResource = 'qb-inventory', KeyResource = 'qb-vehiclekeys',
    RequireKeys = true,

    KeyProvider = nil,

    ConsumeItem = nil,
    Duration = 5000, Cooldown = 7000,
    TorqueMultiplier = 1.65,
    MinimumSpeed = 2.0,
    ParticleAsset = 'core', ParticleName = 'veh_backfire', ParticleScale = 1.0,
    NetworkedParticles = true,
    Command = 'velox-nitro', Key = ''
}

Config.Seatbelt.Ejection = {
    Enabled=true,
    MinimumSpeed=22.0, Deceleration=0.45, MinimumBodyDamage=12.0,
    SampleInterval=100, RagdollDuration=3500
}

Config.Stress.Crashes = {
    Enabled=true, Amount=5, Cooldown=5000, PollInterval=200,
    MinimumSpeed=12.0,
    MinimumDeceleration=0.25, MinimumBodyDamage=10.0, MinimumHealthDamage=2.0,
    DriverOnly=false,
    VehicleClasses = { [0]=true,[1]=true,[2]=true,[3]=true,[4]=true,[5]=true,[6]=true,[7]=true,
        [8]=true,[9]=true,[10]=true,[11]=true,[12]=true,[17]=true,[18]=true,[19]=true,[20]=true }
}
Config.Stress.Falls = {
    Enabled=true, Amount=3, Cooldown=5000, PollInterval=200, MinimumHealthDamage=2.0
}
