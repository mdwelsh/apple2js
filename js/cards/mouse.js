import { debug } from '../util';
import { rom } from '../roms/cards/mouse';

export default function Mouse(io, cpu, cbs) {
    var CLAMP_MIN_LOW = 0x478;
    var CLAMP_MAX_LOW = 0x4F8;
    var CLAMP_MIN_HIGH = 0x578;
    var CLAMP_MAX_HIGH = 0x5F8;

    var X_LOW = 0x478;
    var Y_LOW = 0x4F8;
    var X_HIGH = 0x578;
    var Y_HIGH = 0x5F8;
    var STATUS = 0x778;
    var MODE = 0x7F8;

    var STATUS_DOWN = 0x80;
    var STATUS_LAST = 0x40;
    var STATUS_MOVED = 0x20;
    var INT_SCREEN = 0x08;
    var INT_PRESS = 0x04;
    var INT_MOVE = 0x02;

    var MODE_ON = 0x01;
    var MODE_INT_MOVE = 0x02;
    var MODE_INT_PRESS = 0x04;
    var MODE_INT_VBL = 0x08;

    var _clampXMin = 0;
    var _clampYMin = 0;
    var _clampXMax = 0x3FF;
    var _clampYMax = 0x3FF;
    var _x = 0;
    var _y = 0;
    var _mode;
    var _down = false;
    var _lastDown = false;
    var _lastX = 0;
    var _lastY = 0;
    var _serve = 0;
    var _shouldIntMove = false;
    var _shouldIntPress = false;
    var _slot;

    var ENTRIES = {
        SETMOUSE: 0x20,
        SERVEMOUSE: 0x21,
        READMOUSE: 0x22,
        CLEARMOUSE: 0x23,
        POSMOUSE: 0x24,
        CLAMPMOUSE: 0x25,
        HOMEMOUSE: 0x26,
        INITMOUSE: 0x27
    };

    return {

        read: function (page, off) {
            var state = cpu.getState();

            function holeWrite(addr, val) {
                cpu.write(addr >> 8, (addr & 0xff) + _slot, val);
            }

            function holeRead(addr) {
                return cpu.read(addr >> 8, addr & 0xff);
            }

            function clearCarry() {
                state.s &= 0xFE;
            }

            if (cpu.getSync() && off >= ENTRIES.SETMOUSE && off <= ENTRIES.INITMOUSE) {
                switch (off) {
                    case ENTRIES.SETMOUSE:
                        {
                            _mode = state.a;
                            cbs.mouseMode(_mode & MODE_ON);
                            clearCarry();
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
                        holeWrite(STATUS, _serve);
                        clearCarry();
                        _serve = 0;
                        break;
                    case ENTRIES.READMOUSE:
                        {
                            var moved = (_lastX !== _x) || (_lastY !== _y);
                            var status =
                                (_down ? STATUS_DOWN : 0) |
                                (_lastDown ? STATUS_LAST : 0) |
                                (moved ? STATUS_MOVED : 0);
                            var mouseXLow = _x & 0xff;
                            var mouseYLow = _y & 0xff;
                            var mouseXHigh = _x >> 8;
                            var mouseYHigh = _y >> 8;

                            // debug({ mouseXLow, mouseYLow, mouseXHigh, mouseYHigh });

                            holeWrite(X_LOW, mouseXLow);
                            holeWrite(Y_LOW, mouseYLow);
                            holeWrite(X_HIGH, mouseXHigh);
                            holeWrite(Y_HIGH, mouseYHigh);
                            holeWrite(STATUS, status);
                            holeWrite(MODE, _mode);

                            _lastDown = _down;
                            _lastX = _x;
                            _lastY = _y;

                            clearCarry();
                        }
                        break;
                    case ENTRIES.CLEARMOUSE:
                        debug('clearMouse');
                        clearCarry();
                        break;
                    case ENTRIES.POSMOUSE:
                        debug('posMouse');
                        clearCarry();
                        break;
                    case ENTRIES.CLAMPMOUSE:
                        {
                            var clampY = state.a;
                            if (clampY) {
                                _clampYMin = holeRead(CLAMP_MIN_LOW) | (holeRead(CLAMP_MIN_HIGH) << 8);
                                _clampYMax = holeRead(CLAMP_MAX_LOW) | (holeRead(CLAMP_MAX_HIGH) << 8);
                                debug('clampMouse Y', _clampYMin, _clampYMax);
                            } else {
                                _clampXMin = holeRead(CLAMP_MIN_LOW) | (holeRead(CLAMP_MIN_HIGH) << 8);
                                _clampXMax = holeRead(CLAMP_MAX_LOW) | (holeRead(CLAMP_MAX_HIGH) << 8);
                                debug('clampMouse X', _clampXMin, _clampXMax);
                            }
                            clearCarry();
                        }
                        break;
                    case ENTRIES.HOMEMOUSE:
                        {
                            debug('homeMouse');
                            _x = _clampXMin;
                            _y = _clampYMin;
                            clearCarry();
                        }
                        break;
                    case ENTRIES.INITMOUSE:
                        {
                            _slot = state.y >> 4;
                            debug('initMouse slot', _slot);
                            clearCarry();
                        }
                        break;
                }

                cpu.setState(state);
            }


            return rom[off];
        },

        write: function () {
        },

        tick: function () {
            if (_mode & MODE_INT_VBL) {
                _serve |= INT_SCREEN;
            }
            if ((_mode & MODE_INT_PRESS) && _shouldIntPress) {
                _serve |= INT_PRESS;
            }
            if ((_mode & MODE_INT_MOVE) && _shouldIntMove) {
                _serve |= INT_MOVE;
            }
            if (_serve) {
                cpu.irq();
            }
            _shouldIntMove = false;
            _shouldIntPress = false;
        },

        setMouseXY(x, y, w, h) {
            var rangeX = _clampXMax - _clampXMin;
            var rangeY = _clampYMax - _clampYMin;
            _x = (x * rangeX / w + _clampXMin) & 0xffff;
            _y = (y * rangeY / h + _clampYMin) & 0xffff;
            _shouldIntMove = true;
            // debug('setMouseXY', _x, _y);
        },

        setMouseDown(down) {
            _down = down;
            _shouldIntPress = down;
            // debug('setMouseDown', _down);
        }
    };
}
