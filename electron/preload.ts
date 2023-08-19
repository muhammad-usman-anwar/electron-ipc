import { contextBridge } from "electron/renderer";
import { ElectronIPCRenderer } from "../src";

console.log('hello')
const ipc = ElectronIPCRenderer.initialize();
setTimeout(() => {
    const channel = ipc.get<{ message: string }>('testing');
    //console.log(channel);
    channel?.listen.subscribe(val => {
        console.log(val);
    });
    let i = 1;

    setInterval(() => {
        console.log('sending data')
        channel?.send({ message: `Hi: ${i}` });
        i++;
    }, 1000)

}, 5000);

// For ELectron < v20
// (window as any).ipc = ipc

// For Electron >= v20
contextBridge.exposeInMainWorld('ipc', ipc.asExposed);
