import { ElectronIPC } from "../src";

console.log('hello')
const ipc = ElectronIPC.initialize();
setTimeout(() => {
    const channel = ipc.get<{ message: string }>('testing');
    //console.log(channel);
    channel?.listen.subscribe(val => {
        console.log(val);
    });
    let i = 1;

    setInterval(() => {
        console.log('sending data')
        channel?.send({ message: `HI${i}` });
        i++;
    }, 1000)

}, 5000);
(window as any).ipc = ipc