const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize('wt26', 'root', 'password', {
    host: 'localhost',
    dialect: 'mysql',
    logging: false 
});

const Scenario = sequelize.define('Scenario', {
    title: { type: DataTypes.STRING, allowNull: false }
}, {
    freezeTableName: true, 
    tableName: 'Scenario',
    timestamps: false 
});

const Line = sequelize.define('Line', {
    lineId: { type: DataTypes.INTEGER, allowNull: false },
    text: { type: DataTypes.TEXT }, 
    nextLineId: { type: DataTypes.INTEGER, allowNull: true },
    scenarioId: { type: DataTypes.INTEGER, allowNull: false } 
}, {
    freezeTableName: true,
    tableName: 'Line',
    timestamps: false 
});

const Delta = sequelize.define('Delta', {
    type: { type: DataTypes.STRING, allowNull: false },
    lineId: { type: DataTypes.INTEGER, allowNull: true },
    nextLineId: { type: DataTypes.INTEGER, allowNull: true },
    content: { type: DataTypes.TEXT, allowNull: true },
    oldName: { type: DataTypes.STRING, allowNull: true },
    newName: { type: DataTypes.STRING, allowNull: true },
    timestamp: { type: DataTypes.INTEGER, allowNull: false }, // manuelni timestamp
    scenarioId: { type: DataTypes.INTEGER, allowNull: false } 
}, {
    freezeTableName: true,
    tableName: 'Delta',
    timestamps: false 
});

const Checkpoint = sequelize.define('Checkpoint', {
    timestamp: { type: DataTypes.INTEGER, allowNull: false },
    scenarioId: { type: DataTypes.INTEGER, allowNull: false } 
}, {
    freezeTableName: true,
    tableName: 'Checkpoint',
    timestamps: false 
});

// Relacije 
Scenario.hasMany(Line, { foreignKey: 'scenarioId', onDelete: 'CASCADE' });
Scenario.hasMany(Delta, { foreignKey: 'scenarioId', onDelete: 'CASCADE' });
Scenario.hasMany(Checkpoint, { foreignKey: 'scenarioId', onDelete: 'CASCADE' });

Line.belongsTo(Scenario, { foreignKey: 'scenarioId' });
Delta.belongsTo(Scenario, { foreignKey: 'scenarioId' });
Checkpoint.belongsTo(Scenario, { foreignKey: 'scenarioId' });

module.exports = { sequelize, Scenario, Line, Delta, Checkpoint };