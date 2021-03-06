import { Types } from '../types.namespace';

import Terminal from '../modules/Terminal';
import Colors from '../modules/Colors';

import { v4 as uuidv4 } from 'uuid';

type TText = {
    id: string;

    x: number;
    y: number;

    text: string;
    renderedtext: string;

    color: Types.color;
    hovercolor: Types.color;

    maxLength: number | null;
    clearStr: string;

    setXY(x: number, y: number): void;
    setText(text: string): void;
    setMaxLength(maxlen: number): void;
    setColors(color: Types.color, hovercolor: Types.color): void;
    adjustText(): void;
    render(hover: boolean): void;
    clear(): void;
    onResize(): void;
}

export default class Text implements TText {
    id: string;

    x: number;
    y: number;

    text: string;
    renderedtext: string;

    purifiedText: string;
    explodedText: string[];

    color: Types.color;
    hovercolor: Types.color;

    paddingLeft: number;
    maxLength: number | null;
    clearStr: string;

    constructor(text: string, color: Types.color, hovercolor: Types.color = 'white') {
        this.id = uuidv4();

        this.x = -1;
        this.y = -1;

        this.text = text;
        this.renderedtext = text;

        this.purifiedText = Colors.purify(this.text);
        this.explodedText = Colors.explode(this.text);

        this.color = color;
        this.hovercolor = hovercolor;

        this.maxLength = null;
        this.clearStr = ' '.repeat(this.text.length);
        this.paddingLeft = 0;
    }

    public setXY(x: number, y: number): void {
        this.x = x;
        this.y = y;
    }

    public setText(text: string): void {
        this.text = text;
        this.clearStr = ' '.repeat(this.text.length);

        this.purifiedText = Colors.purify(this.text);
        this.explodedText = Colors.explode(this.text);
    }

    public setMaxLength(maxlen: number): void {
        this.maxLength = maxlen;
        this.clearStr = ' '.repeat(Math.abs(this.maxLength));
    }

    public setColors(color: Types.color, hovercolor: Types.color): void {
        this.color = color;
        this.hovercolor = hovercolor;
    }

    public setPaddingLeft(paddingLeft: number) {
        this.paddingLeft = paddingLeft;
    }

    public adjustText(): void {
        let paddingText: string = this.paddingLeft > 0 ?
            ' '.repeat(this.paddingLeft) :
            '';

        this.renderedtext = paddingText + this.text;

        if (this.maxLength != null) { 
            if (this.maxLength < this.purifiedText.length + this.paddingLeft) {
                let newtext: string = Colors.reCreateColoredText(this.explodedText, this.maxLength - 3 - this.paddingLeft);

                this.renderedtext = `${paddingText}${newtext}...`;
            }
        }
    }

    public render(hover: boolean): void {
        if (this.x != -1 && this.y != -1) {
            Terminal.cursorXY(this.x, this.y);

            let output: string = hover ? 
                Colors.get(this.hovercolor, this.renderedtext) :
                Colors.get(this.color, this.renderedtext);

            process.stdout.write(output);
        }
    }

    public clear(): void {
        if (this.x != -1 && this.y != -1) {
            Terminal.cursorXY(this.x, this.y);
            process.stdout.write(this.clearStr);
        }
    }

    public onResize(): void {
        let width: number = this.x + this.purifiedText.length + this.paddingLeft >= process.stdout.columns ?
            process.stdout.columns - this.x : 
            this.purifiedText.length;

        this.setMaxLength(width);
        this.adjustText();
        this.render(false);
    }
}
