import { BrowserWindow, ipcMain, ipcRenderer } from "electron";
import { BehaviorSubject } from "rxjs";
import { filter } from "rxjs/operators";
import { Channel, ControlFlags, ELectronProcessTypes, SignalData } from "./types"

export class ElectronIPC {
    private static _instance: ElectronIPC;
    private que: string[];
    private win: BrowserWindow;
    private isInitialized: boolean = false;
    readonly channels: Channel;
    private _stateSubject: BehaviorSubject<boolean>;
    private constructor(win?: BrowserWindow) {
        if (this.isMain && !win) throw new Error('Browser window is missing');
        this._stateSubject = new BehaviorSubject(false);
        if (win)
            this.win = win;
        this.que = [];
        this.channels = {
            incoming: {},
            outgoing: {},
        };
        if (this.isMain) this.initMain();
        else this.initRenderer();
    }

    public static initialize(win?: BrowserWindow): ElectronIPC {
        if (!this._instance) this._instance = new ElectronIPC(win)
        return this._instance
    }

    public get initState() {
        return this._stateSubject.asObservable();
    }

    public static get instance() {
        return this._instance
    }

    public getLocal<T>(subjectName: string) {
        return <BehaviorSubject<T>>this.channels?.outgoing[subjectName];
    }

    public get<T>(subjectName: string) {
        return <BehaviorSubject<T>>this.channels?.incoming[subjectName];
    }

    public getObservable<T>(subjectName: string) {
        return (<BehaviorSubject<T>>this.channels?.incoming[subjectName])?.pipe(filter(val => val ? true : false));
    }

    public getLocalObservable<T>(subjectName: string) {
        return (<BehaviorSubject<T>>this.channels?.outgoing[subjectName])?.pipe(filter(val => val ? true : false));
    }

    public addChanel<T>(name: string, data: T) {
        const subject = this.setDataLocal({ channel: name, data });
        if (subject) {
            subject.subscribe(val => {
                (this.isMain ? this.win?.webContents : ipcRenderer).send(ControlFlags.DATA,
                    {
                        channel: name,
                        data: val,
                    } as SignalData<unknown>);
            });
        }
        return subject;
    }

    private get isMain(): boolean {
        return process?.type === ELectronProcessTypes.BROWSER;
    }

    private resetSubjects(type: 'INCOMING' | 'OUTGOING') {
        const subjects = type === 'INCOMING' ? this.channels?.incoming : this.channels?.outgoing;
        Object.entries(subjects).forEach(([key, val]) => {
            try {
                val.unsubscribe();
                delete subjects[key];
            } catch (error) {
                console.log(error)
            }
        });
    }

    private setData(sd: SignalData<unknown>) {
        if (!sd) return;
        const subjects = this.channels.incoming;
        const subject = subjects[sd.channel];
        if (!subject) {
            subjects[sd.channel] = new BehaviorSubject(sd.data);
            return subjects[sd.channel];
        }
        else subject.next(sd.data)
    }

    private setDataLocal(sd: SignalData<unknown>) {
        if (!sd) return;
        const subjects = this.channels.outgoing;
        const subject = subjects[sd.channel];
        if (!subject) {
            if (!this.isInitialized) this.que.push(sd.channel);
            subjects[sd.channel] = new BehaviorSubject(sd.data);
            return subjects[sd.channel];
        }
        else subject.next(sd.data)
    }

    private initMain() {
        //console.log('init main');
        ipcMain.once(ControlFlags.INIT, (event) => {
            //console.log('init renderer')
            this.resetSubjects('INCOMING');
            this.isInitialized = true;
            this.win.webContents.send(ControlFlags.INIT);
            this.que?.forEach(subjectName => {
                this.win.webContents.send(ControlFlags.CREATE,
                    {
                        channel: subjectName,
                        data: this.channels?.outgoing[subjectName]?.value
                    } as SignalData<unknown>);
            });
            this.que = [];
            this._stateSubject.next(this.isInitialized);
        });

        ipcMain.on(ControlFlags.CREATE, (event, data: SignalData<unknown>) => {
            this.setData(data);
        });
        ipcMain.on(ControlFlags.CLOSE, (event, data: SignalData<unknown>) => {
            const subjects = this.channels?.incoming;
            if (subjects[data.channel]) {
                subjects[data.channel].unsubscribe();
                setTimeout(() => {
                    delete subjects[data.channel];
                });
            }
        });
        ipcMain.on(ControlFlags.DATA, (event, data: SignalData<unknown>) => {
            this.setData(data);
        });
        ipcMain.once(ControlFlags.QUIT, (event) => {
            this.resetSubjects('INCOMING');
            this.isInitialized = false;
            this._stateSubject.next(this.isInitialized);
            this.loadQue();
        });

    }

    private loadQue() {
        Object.keys(this.channels?.outgoing)?.forEach(val => { this.que.push(val) });
    }
    private initRenderer() {
        //console.log('init renderer')
        ipcRenderer.once(ControlFlags.INIT, (event) => {
            //console.log('init main')
            this.resetSubjects('INCOMING');
            this.isInitialized = true;
            this.que?.forEach(subjectName => {
                ipcRenderer.send(ControlFlags.CREATE,
                    {
                        channel: subjectName,
                        data: this.channels?.outgoing[subjectName]?.value
                    } as SignalData<unknown>);
            });
            this.que = [];
            this._stateSubject.next(this.isInitialized);
        })

        ipcRenderer.on(ControlFlags.CREATE, (event, data: SignalData<unknown>) => {
            this.setData(data);
        });
        ipcRenderer.on(ControlFlags.CLOSE, (event, data: SignalData<unknown>) => {
            const subjects = this.channels?.incoming;
            if (subjects[data.channel]) {
                subjects[data.channel].unsubscribe();
                setTimeout(() => {
                    delete subjects[data.channel];
                });
            }
        });
        ipcRenderer.on(ControlFlags.DATA, (event, data: SignalData<unknown>) => {
            this.setData(data);
        });
        ipcRenderer.once(ControlFlags.QUIT, (event) => {
            this.resetSubjects('INCOMING');
            this.isInitialized = false;
            this._stateSubject.next(this.isInitialized);
            this.loadQue();
        });

        ipcRenderer.send(ControlFlags.INIT);
    }
}