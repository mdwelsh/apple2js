import Apple2IO from '../apple2io';
import { BOOLEAN_OPTION, OptionHandler } from './options_modal';

const JOYSTICK_DISABLE = 'disable_mouse';
const JOYSTICK_FLIP_X_AXIS = 'flip_x';
const JOYSTICK_FLIP_Y_AXIS = 'flip_y';
const JOYSTICK_SWAP_AXIS = 'swap_x_y';

export class JoyStick implements OptionHandler {
    private disableMouseJoystick = false;
    private flipX = false;
    private flipY = false;
    private swapXY = false;
    private gamepad = false;

    constructor(private io: Apple2IO) {
        document.addEventListener('mousemove', this.mousemove);
        document.querySelectorAll('canvas').forEach((canvas) => {
            canvas.addEventListener('mousedown', (evt) => {
                if (!this.gamepad) {
                    io.buttonDown(evt.which == 1 ? 0 : 1);
                }
                evt.preventDefault();
            });
            canvas.addEventListener('mouseup', (evt) => {
                if (!this.gamepad) {
                    io.buttonUp(evt.which == 1 ? 0 : 1);
                }
            });
            canvas.addEventListener('touchstart', (evt) => {
                this.touchpos(evt);
                if (!this.gamepad) {
                    io.buttonDown(0);
                }
                evt.preventDefault();
            });
            canvas.addEventListener('touchend', (_evt) => {
                if (!this.gamepad) {
                    io.buttonUp(0);
                }
            });
            canvas.addEventListener('contextmenu', (evt) => {
                evt.preventDefault();
            });
        });
        window.addEventListener('gamepadconnected', (e: GamepadEvent) => {
            this.gamepad = !!e.gamepad;
        });
    }

    getOptions() {
        return [
            {
                name: 'Joystick',
                options: [
                    {
                        name: JOYSTICK_DISABLE,
                        label: 'Disable Mouse Joystick',
                        type: BOOLEAN_OPTION,
                        defaultVal: false,
                    },
                    {
                        name: JOYSTICK_FLIP_X_AXIS,
                        label: 'Flip X-Axis',
                        type: BOOLEAN_OPTION,
                        defaultVal: false,
                    },
                    {
                        name: JOYSTICK_FLIP_Y_AXIS,
                        label: 'Flip Y-Axis',
                        type: BOOLEAN_OPTION,
                        defaultVal: false,
                    },
                    {
                        name: JOYSTICK_SWAP_AXIS,
                        label: 'Swap Axis',
                        type: BOOLEAN_OPTION,
                        defaultVal: false,
                    },
                ],
            },
        ];
    }

    setOption(name: string, _value: boolean) {
        switch (name) {
            case JOYSTICK_DISABLE:
                this.io.paddle(0, 0.5);
                this.io.paddle(1, 0.5);
                break;
            case JOYSTICK_FLIP_X_AXIS:
            case JOYSTICK_FLIP_Y_AXIS:
            case JOYSTICK_SWAP_AXIS:
        }
    }

    private setMouseCoordinates(x: number, y: number) {
        // These roughly correspond to the x/y ranges of the displayed
        // part of the canvas. If the display is adjusted in canvas.ts,
        // these values would need to be updated too.
        const LOWER_X = 0.15;
        const LOWER_Y = 0.18;
        const UPPER_X = 0.75;
        const UPPER_Y = 0.8;
        x -= LOWER_X;
        y -= LOWER_Y;
        x /= (UPPER_X - LOWER_X);
        y /= (UPPER_Y - LOWER_Y);
        x = Math.max(0, Math.min(1.0, x));
        y = Math.max(0, Math.min(1.0, y));
        
        const z = x;
        if (this.swapXY) {
            x = y;
            y = z;
        }
        this.io.paddle(0, this.flipX ? 1 - x : x);
        this.io.paddle(1, this.flipY ? 1 - y : y);
    }

    private mousemove = (evt: MouseEvent) => {
        if (this.gamepad || this.disableMouseJoystick) {
            return;
        }

        const s = document.querySelector<HTMLDivElement>('#screen')!;
        const offset = s.getBoundingClientRect();

        // MDW: Updated the following since the canvas is not
        // spanning the entire display.
        let x = (evt.pageX - offset.left) / s.clientWidth;
        let y = (evt.pageY - offset.top) / s.clientHeight;

        this.setMouseCoordinates(x, y);
    }

    private touchpos = (evt: TouchEvent) => {
        if (this.gamepad || this.disableMouseJoystick) {
            return;
        }

        const s = document.querySelector<HTMLDivElement>('#screen')!;
        const offset = s.getBoundingClientRect();

        // This is a bit naive as it just iterates through
        // all of the new touches and sets the paddle positions
        // for each.
        for (let i=0; i < evt.changedTouches.length; i++) {
            let touch = evt.changedTouches.item(i);
            let x = (touch!.pageX - offset.left) / s.clientWidth;
            let y = (touch!.pageY - offset.top) / s.clientHeight;
            this.setMouseCoordinates(x, y);
        }
    }
}
