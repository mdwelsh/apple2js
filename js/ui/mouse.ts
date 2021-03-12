import Mouse from '../cards/mouse';
import { enableMouseMode} from './apple2';

export class MouseUI {
    private mouse: Mouse

    constructor(private canvas: HTMLCanvasElement)  {
        this.canvas.addEventListener('mousemove', (event: any) => {
            this.mouse.setMouseXY(
                event.offsetX,
                event.offsetY,
                event.target.clientWidth,
                event.target.clientHeight
            );
        });

        this.canvas.addEventListener('mousedown', () => {
            this.mouse.setMouseDown(true);
        });

        this.canvas.addEventListener('mouseup', () => {
            this.mouse.setMouseDown(false);
        });
    }

    setMouse = (mouse: Mouse) => {
        this.mouse = mouse;
    }

    mouseMode = (on: boolean) => {
        enableMouseMode(on);
        if (on) {
            this.canvas.classList.add('mouseMode');
        } else {
            this.canvas.classList.remove('mouseMode');
        }
    }
}
