// main.js

// Modules to control application life and create native browser window
import { app, BrowserWindow } from 'electron'
import { join as joinPath } from 'path'
import { ElectronIPC } from "../src";

function createWindow() {
    // Create the browser window.
    const mainWindow = new BrowserWindow({
        width: 1000,
        height: 600,
        webPreferences: {
            preload: joinPath(__dirname, 'preload.js')
        }
    })

    // and load the index.html of the app.
    mainWindow.loadFile('../../../electron/index.html')

    // Open the DevTools.
    mainWindow.webContents.openDevTools()
    const ipc = ElectronIPC.initialize(mainWindow);
    const channel = ipc.addChanel('testing', { message: 'done' });
    channel.listen?.subscribe(val => {
        console.log(val);
    });
    setTimeout(() => {
        channel.send({ message: 'exit please' })
    }, 10000)
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
    createWindow()

    app.on('activate', function () {
        // On macOS it's common to re-create a window in the app when the
        // dock icon is clicked and there are no other windows open.
        if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
