import { byte, word } from '../types';
import CPU6502, { CpuState } from '../cpu6502';
import { debug } from '../util';
import { rom } from '../roms/cards/mouse';

const CLAMP_MIN_LOW = 0x478;
const CLAMP_MAX_LOW = 0x4F8;
const CLAMP_MIN_HIGH = 0x578;
const CLAMP_MAX_HIGH = 0x5F8;

const X_LOW = 0x478;
const Y_LOW = 0x4F8;
const X_HIGH = 0x578;
const Y_HIGH = 0x5F8;
const STATUS = 0x778;
const MODE = 0x7F8;

const STATUS_DOWN = 0x80;
const STATUS_LAST = 0x40;
const STATUS_MOVED = 0x20;
const INT_SCREEN = 0x08;
const INT_PRESS = 0x04;
const INT_MOVE = 0x02;

const MODE_ON = 0x01;
const MODE_INT_MOVE = 0x02;
const MODE_INT_PRESS = 0x04;
const MODE_INT_VBL = 0x08;

const ENTRIES = {
    SETMOUSE: 0x20,
    SERVEMOUSE: 0x21,
    READMOUSE: 0x22,
    CLEARMOUSE: 0x23,
    POSMOUSE: 0x24,
    CLAMPMOUSE: 0x25,
    HOMEMOUSE: 0x26,
    INITMOUSE: 0x27
};

export default class Mouse {
    private clampXMin = 0;
    private clampYMin = 0;
    private clampXMax = 0x3FF;
    private clampYMax = 0x3FF;
    private x = 0;
    private y = 0;
    private mode = 0;
    private down = false;
    private lastDown = false;
    private lastX = 0;
    private lastY = 0;
    private serve = 0;
    private shouldIntMove = false;
    private shouldIntPress = false;
    private slot = 0

    constructor(
        private cpu: CPU6502,
        private cbs: {
            setMouse: (mouse: Mouse) => void,
            mouseMode: (on: boolean) => void
        }
    ) {
        this.cbs.setMouse(this);
    }

    read(_page: byte, off: byte) {
        let state =this.cpu.getState();

        const holeWrite = (addr: word, val: byte) => {
            this.cpu.write(addr >> 8, (addr & 0xff) + this.slot, val);
        };

        const holeRead = (addr: word) => {
            return this.cpu.read(addr >> 8, addr & 0xff);
        };

        const clearCarry = (state: CpuState) => {
            state.s &= 0xFE;
            return state;
        };

        if (this.cpu.getSync() && off >= ENTRIES.SETMOUSE && off <= ENTRIES.INITMOUSE) {
            switch (off) {
                case ENTRIES.SETMOUSE:
                    {
                        this.mode = state.a;
                        this.cbs.mouseMode(!!(this.mode & MODE_ON));
                        state = clearCarry(state);
                        // debug(
                        //     'setMouse ',
                        //     (_mode & MODE_ON ? 'Mouse on ' : 'Mouse off '),
                        //     (_mode & MODE_INT_MOVE ? 'Move interrupt ' : '') +
                        //     (_mode & MODE_INT_PRESS ? 'Move press ' : '') +
                        //     (_mode & MODE_INT_VBL ? 'Move VBL ' : '')
                        // );
                    }
                    break;
                case ENTRIES.SERVEMOUSE:
                    // debug('serveMouse');
                    holeWrite(STATUS, this.serve);
                    state = clearCarry(state);
                    this.serve = 0;
                    break;
                case ENTRIES.READMOUSE:
                    {
                        const moved = (this.lastX !== this.x) || (this.lastY !== this.y);
                        const status =
                            (this.down ? STATUS_DOWN : 0) |
                            (this.lastDown ? STATUS_LAST : 0) |
                            (moved ? STATUS_MOVED : 0);
                        const mouseXLow = this.x & 0xff;
                        const mouseYLow = this.y & 0xff;
                        const mouseXHigh = this.x >> 8;
                        const mouseYHigh = this.y >> 8;

                        // debug({ mouseXLow, mouseYLow, mouseXHigh, mouseYHigh });

                        holeWrite(X_LOW, mouseXLow);
                        holeWrite(Y_LOW, mouseYLow);
                        holeWrite(X_HIGH, mouseXHigh);
                        holeWrite(Y_HIGH, mouseYHigh);
                        holeWrite(STATUS, status);
                        holeWrite(MODE, this.mode);

                        this.lastDown = this.down;
                        this.lastX = this.x;
                        this.lastY = this.y;

                        state = clearCarry(state);
                    }
                    break;
                case ENTRIES.CLEARMOUSE:
                    debug('clearMouse');
                    state = clearCarry(state);
                    break;
                case ENTRIES.POSMOUSE:
                    debug('posMouse');
                    state = clearCarry(state);
                    break;
                case ENTRIES.CLAMPMOUSE:
                    {
                        const clampY = state.a;
                        if (clampY) {
                            this.clampYMin = holeRead(CLAMP_MIN_LOW) | (holeRead(CLAMP_MIN_HIGH) << 8);
                            this.clampYMax = holeRead(CLAMP_MAX_LOW) | (holeRead(CLAMP_MAX_HIGH) << 8);
                            debug('clampMouse Y', this.clampYMin, this.clampYMax);
                        } else {
                            this.clampXMin = holeRead(CLAMP_MIN_LOW) | (holeRead(CLAMP_MIN_HIGH) << 8);
                            this.clampXMax = holeRead(CLAMP_MAX_LOW) | (holeRead(CLAMP_MAX_HIGH) << 8);
                            debug('clampMouse X', this.clampXMin, this.clampXMax);
                        }
                        state = clearCarry(state);
                    }
                    break;
                case ENTRIES.HOMEMOUSE:
                    {
                        debug('homeMouse');
                        this.x = this.clampXMin;
                        this.y = this.clampYMin;
                        state = clearCarry(state);
                    }
                    break;
                case ENTRIES.INITMOUSE:
                    {
                        this.slot = state.y >> 4;
                        debug('initMouse slot', this.slot);
                        state = clearCarry(state);
                    }
                    break;
            }

            this.cpu.setState(state);
        }


        return rom[off];
    }

    write() {}

    tick() {
        if (this.mode & MODE_INT_VBL) {
            this.serve |= INT_SCREEN;
        }
        if ((this.mode & MODE_INT_PRESS) && this.shouldIntPress) {
            this.serve |= INT_PRESS;
        }
        if ((this.mode & MODE_INT_MOVE) && this.shouldIntMove) {
            this.serve |= INT_MOVE;
        }
        if (this.serve) {
            this.cpu.irq();
        }
        this.shouldIntMove = false;
        this.shouldIntPress = false;
    }

    setMouseXY(x: number, y: number, w: number, h: number) {
        const rangeX = this.clampXMax - this.clampXMin;
        const rangeY = this.clampYMax - this.clampYMin;
        this.x = (x * rangeX / w + this.clampXMin) & 0xffff;
        this.y = (y * rangeY / h + this.clampYMin) & 0xffff;
        this.shouldIntMove = true;
    }

    setMouseDown(down: boolean) {
        this.shouldIntPress = this.down !== down;
        this.down = down;
    }
}
