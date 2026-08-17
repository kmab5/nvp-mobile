// Expo's default Metro config, stated explicitly.
//
// Expo works without this file, but having it makes the bundler's starting
// point visible and gives one obvious place to extend if the asset or source
// extension lists ever need changing.
const { getDefaultConfig } = require('expo/metro-config');

module.exports = getDefaultConfig(__dirname);
