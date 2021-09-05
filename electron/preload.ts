import { BehaviorSubject } from "rxjs";
import { ElectronIPC } from "../src/ELectronIPC";

console.log('hello')
const ipc = ElectronIPC.initialize();
const subject: BehaviorSubject<{ message?: string }> = ipc.addChanel('testing', { message: 'renderer' });
setTimeout(() => {
    ipc.get<string>('testing')?.subscribe(val => {
        console.log(val);
    });
    const local = ipc.get
    let i = 1;
    setInterval(() => {
        console.log('sending data')
        subject.next({ message: `HI${i}` });
        i++;
    }, 1000)
}, 5000);