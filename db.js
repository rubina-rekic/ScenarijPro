const { Sequelize, DataTypes } = require('sequelize');

const sequelize = new Sequelize('wt26', 'root', '', {
    host: 'localhost',
    dialect: 'mysql',
    logging: false
});

const Scenario = sequelize.define('Scenario', {
    title: { type: DataTypes.STRING, allowNull: false }
});

const Line = sequelize.define('Line', {
    lineId: { type: DataTypes.INTEGER, allowNull: false },
    text: { type: DataTypes.TEXT },
    nextLineId: { type: DataTypes.INTEGER, allowNull: true },
    scenarioId: { type: DataTypes.INTEGER, allowNull: false } 
});

const Delta = sequelize.define('Delta', {
    type: { type: DataTypes.STRING, allowNull: false },
    lineId: { type: DataTypes.INTEGER, allowNull: true },
    nextLineId: { type: DataTypes.INTEGER, allowNull: true },
    content: { type: DataTypes.TEXT, allowNull: true },
    oldName: { type: DataTypes.STRING, allowNull: true },
    newName: { type: DataTypes.STRING, allowNull: true },
    timestamp: { type: DataTypes.INTEGER, allowNull: false },
    scenarioId: { type: DataTypes.INTEGER, allowNull: false } 
});

const Checkpoint = sequelize.define('Checkpoint', {
    timestamp: { type: DataTypes.INTEGER, allowNull: false },
    scenarioId: { type: DataTypes.INTEGER, allowNull: false } 
});


Scenario.hasMany(Line, { foreignKey: 'scenarioId', onDelete: 'CASCADE' });
Scenario.hasMany(Delta, { foreignKey: 'scenarioId', onDelete: 'CASCADE' });
Scenario.hasMany(Checkpoint, { foreignKey: 'scenarioId', onDelete: 'CASCADE' });

module.exports = { sequelize, Scenario, Line, Delta, Checkpoint };