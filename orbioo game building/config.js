module.exports = {
    host: "0.0.0.0",
    port: 3002,
    logpath: "logger.php",
    foodMass: 10,
    fireFood: 20,
    limitSplit: 16,
    defaultPlayerMass: 15,
	virus: {
        fill: "#33ff33",
        stroke: "#19D119",
        strokeWidth: 20,
        defaultMass: {
            from: 100,
            to: 150
        },
        splitMass: 180,
        uniformDisposition: false,
	},
    gameWidth: 10000,
    gameHeight: 10000,
    adminPass: "DEFAULT",
    gameMass: 40000,
    maxFood: 3000,
    maxVirus: 80,
    slowBase: 4.5,
    logChat: 0,
    networkUpdateFactor: 40,
    maxHeartbeatInterval: 5000,
    foodUniformDisposition: true,
    newPlayerInitialPosition: "farthest",
    massLossRate: 0.002,
    minMassLoss: 400,
    sqlinfo: {
      fileName: "db.sqlite3",
    }
};
