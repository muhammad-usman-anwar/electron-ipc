import { BehaviorSubject } from "rxjs";

export enum SubjectTypes {
    SUBJECT,
    BEHAVIOR_SUBJECT,
    REPLAY_SUBJECT,
    ASYNC_SUBJECT
}

export enum ControlFlags {
    INIT = 'init',
    QUIT = 'quit',
    CLOSE = 'close',
    CREATE = 'create',
    FAIL = 'fail',
    DATA = 'data',
}

export enum ELectronProcessTypes {
    BROWSER = 'browser',
    RENDERER = 'renderer',
}

export interface SignalData<T> {
    channel: string;
    data?: T;
}

export interface Channel {
    incoming: { [index: string]: BehaviorSubject<unknown> },
    outgoing: { [index: string]: BehaviorSubject<unknown> },
}