/**
 * TEST ONLY. To be imported before `appium-remote-debugger`. That package logs every message it
 * exchanges with WebKit's inspector, the answers of the page included, through a logger that is
 * chosen once, when the package loads; in what it calls testing mode that logger writes nothing.
 */
process.env._TESTING = '1';
