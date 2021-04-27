import { Callbacks, DriveNumber } from '../cards/disk2';

export default class DriveLights implements Callbacks {
    public driveLight(_drive: DriveNumber, _on: boolean) {
        // const disk =
        //     document.querySelector('#disk' + drive)! as HTMLElement;
        // disk.style.backgroundImage =
        //     on ? 'url(css/red-on-16.png)' :
        //         'url(css/red-off-16.png)';
    }

    public dirty(_drive: DriveNumber, _dirty: boolean) {
        // document.querySelector('#disksave' + drive).disabled = !dirty;
    }

    public label(_drive: DriveNumber, _label?: string) {
        // const labelElement =
        //     document.querySelector('#disk-label' + drive)! as HTMLElement;
        // if (label) {
        //     labelElement.innerText = label;
        // }
        // return labelElement.innerText;
    }
}
