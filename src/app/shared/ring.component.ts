import { Component, computed, input } from '@angular/core';

/** A progress ring: the coloured arc on a pale track of the same colour, content in the middle. */
@Component({
  selector: 'fw-ring',
  template: `
    <svg [attr.width]="size()" [attr.height]="size()" [attr.viewBox]="'0 0 ' + size() + ' ' + size()" aria-hidden="true">
      <circle [attr.cx]="c()" [attr.cy]="c()" [attr.r]="r()" fill="none" [attr.stroke-width]="stroke()"
              [style.stroke]="'var(' + color() + ')'" opacity="0.16" />
      <circle [attr.cx]="c()" [attr.cy]="c()" [attr.r]="r()" fill="none" [attr.stroke-width]="stroke()"
              stroke-linecap="round" [style.stroke]="'var(' + color() + ')'"
              [attr.stroke-dasharray]="length()" [attr.stroke-dashoffset]="offset()"
              [attr.transform]="'rotate(-90 ' + c() + ' ' + c() + ')'" class="arc" />
    </svg>
    <div class="inside"><ng-content /></div>
  `,
  styles: `
    :host { position: relative; display: inline-grid; place-items: center; flex: none; }
    .inside { position: absolute; inset: 0; display: grid; place-items: center; text-align: center; }
    .arc { transition: stroke-dashoffset 0.5s ease; }
  `,
})
export class RingComponent {
  readonly value = input(0);
  readonly max = input(1);
  readonly color = input('--c-kcal');
  readonly size = input(140);
  readonly stroke = input(12);

  protected readonly c = computed(() => this.size() / 2);
  protected readonly r = computed(() => (this.size() - this.stroke()) / 2);
  protected readonly length = computed(() => 2 * Math.PI * this.r());
  protected readonly offset = computed(() => {
    const share = this.max() > 0 ? Math.min(1, Math.max(0, this.value() / this.max())) : 0;
    return this.length() * (1 - share);
  });
}
