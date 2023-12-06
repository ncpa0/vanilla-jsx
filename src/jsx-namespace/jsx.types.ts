/* eslint-disable @typescript-eslint/triple-slash-reference */
/// <reference path="./prop-types/a-jsx-props.ts" />
/// <reference path="./prop-types/area-jsx-props.ts" />
/// <reference path="./prop-types/audio-jsx-props.ts" />
/// <reference path="./prop-types/base-jsx-props.ts" />
/// <reference path="./prop-types/bdo-jsx-props.ts" />
/// <reference path="./prop-types/blockquote-jsx-props.ts" />
/// <reference path="./prop-types/button-jsx-props.ts" />
/// <reference path="./prop-types/canvas-jsx-props.ts" />
/// <reference path="./prop-types/col-jsx-props.ts" />
/// <reference path="./prop-types/colgroup-jsx-props.ts" />
/// <reference path="./prop-types/data-jsx-props.ts" />
/// <reference path="./prop-types/del-jsx-props.ts" />
/// <reference path="./prop-types/details-jsx-props.ts" />
/// <reference path="./prop-types/dialog-jsx-props.ts" />
/// <reference path="./prop-types/embed-jsx-props.ts" />
/// <reference path="./prop-types/form-jsx-props.ts" />
/// <reference path="./prop-types/html-jsx-props.ts" />
/// <reference path="./prop-types/iframe-jsx-props.ts" />
/// <reference path="./prop-types/img-jsx-props.ts" />
/// <reference path="./prop-types/input-jsx-props.ts" />
/// <reference path="./prop-types/ins-jsx-props.ts" />
/// <reference path="./prop-types/label-jsx-props.ts" />
/// <reference path="./prop-types/li-jsx.props.ts" />
/// <reference path="./prop-types/link-jsx-props.ts" />
/// <reference path="./prop-types/map-jsx-props.ts" />
/// <reference path="./prop-types/meta-jsx-props.ts" />
/// <reference path="./prop-types/meter-jsx-props.ts" />
/// <reference path="./prop-types/object-jsx-props.ts" />
/// <reference path="./prop-types/ol-jsx-props.ts" />
/// <reference path="./prop-types/optgroup-jsx-props.ts" />
/// <reference path="./prop-types/option-jsx-props.ts" />
/// <reference path="./prop-types/output-jsx-props.ts" />
/// <reference path="./prop-types/param-jsx-props.ts" />
/// <reference path="./prop-types/progress-jsx-props.ts" />
/// <reference path="./prop-types/q-jsx-props.ts" />
/// <reference path="./prop-types/script-jsx-props.ts" />
/// <reference path="./prop-types/select-jsx-props.ts" />
/// <reference path="./prop-types/source-jsx-props.ts" />
/// <reference path="./prop-types/style-jsx-props.ts" />
/// <reference path="./prop-types/td-jsx-props.ts" />
/// <reference path="./prop-types/textarea-jsx-props.ts" />
/// <reference path="./prop-types/th-jsx-props.ts" />
/// <reference path="./prop-types/time-jsx-props.ts" />
/// <reference path="./prop-types/track-jsx-props.ts" />
/// <reference path="./prop-types/video-jsx-props.ts" />

import { AttributeBool } from "./prop-types/shared/bool";

export {};

type HTMLElement = Element;

declare global {
  namespace JSX {
    type SignalValue = null | undefined | boolean | string | number;

    interface SignalRemove<V> {
      add(listener: (value: V) => void): void;
      remove(listener: (value: V) => void): void;
    }

    interface SignalDetach<V> {
      add(listener: (value: V) => void): { detach(): void };
    }

    type Signal<V = any> =
      | SignalRemove<V>
      | SignalDetach<V>;

    type VanillaValue = Signal<any> | null | undefined | boolean | string | number;

    type Element = HTMLElement | DocumentFragment | VanillaValue;

    type HTMLProps<P> =
      & {
        [K in keyof P]: Signal<P[K]> | P[K];
      }
      & {
        [K in keyof BaseAttributes]: Signal<BaseAttributes[K]> | BaseAttributes[K];
      };

    interface IntrinsicElements {
      a: HTMLProps<VanillaJSX.AnchorTagProps>;
      abbr: HTMLProps<VanillaJSX.AbbrTagProps>;
      address: HTMLProps<VanillaJSX.AddressTagProps>;
      area: HTMLProps<VanillaJSX.AreaTagProps>;
      article: HTMLProps<VanillaJSX.ArticleTagProps>;
      aside: HTMLProps<VanillaJSX.AsideTagProps>;
      audio: HTMLProps<VanillaJSX.AudioTagProps>;
      b: HTMLProps<VanillaJSX.BTagProps>;
      base: HTMLProps<VanillaJSX.BaseTagProps>;
      bdi: HTMLProps<VanillaJSX.BdiTagProps>;
      bdo: HTMLProps<VanillaJSX.BdoTagProps>;
      big: HTMLProps<VanillaJSX.BigTagProps>;
      blockquote: HTMLProps<VanillaJSX.BlockquoteTagProps>;
      body: HTMLProps<VanillaJSX.BodyTagProps>;
      br: HTMLProps<VanillaJSX.BrTagProps>;
      button: HTMLProps<VanillaJSX.ButtonTagProps>;
      canvas: HTMLProps<VanillaJSX.CanvasTagProps>;
      caption: HTMLProps<VanillaJSX.CaptionTagProps>;
      cite: HTMLProps<VanillaJSX.CiteTagProps>;
      code: HTMLProps<VanillaJSX.CodeTagProps>;
      col: HTMLProps<VanillaJSX.ColTagProps>;
      colgroup: HTMLProps<VanillaJSX.ColgroupTagProps>;
      data: HTMLProps<VanillaJSX.DataTagProps>;
      datalist: HTMLProps<VanillaJSX.DatalistTagProps>;
      dd: HTMLProps<VanillaJSX.DdTagProps>;
      del: HTMLProps<VanillaJSX.DelTagProps>;
      details: HTMLProps<VanillaJSX.DetailsTagProps>;
      dfn: HTMLProps<VanillaJSX.DfnTagProps>;
      dialog: HTMLProps<VanillaJSX.DialogTagProps>;
      div: HTMLProps<VanillaJSX.DivTagProps>;
      dl: HTMLProps<VanillaJSX.DlTagProps>;
      dt: HTMLProps<VanillaJSX.DtTagProps>;
      em: HTMLProps<VanillaJSX.EmTagProps>;
      embed: HTMLProps<VanillaJSX.EmbedTagProps>;
      fieldset: HTMLProps<VanillaJSX.FieldsetTagProps>;
      figcaption: HTMLProps<VanillaJSX.FigcaptionTagProps>;
      figure: HTMLProps<VanillaJSX.FigureTagProps>;
      footer: HTMLProps<VanillaJSX.FooterTagProps>;
      form: HTMLProps<VanillaJSX.FormTagProps>;
      h1: HTMLProps<VanillaJSX.H1TagProps>;
      h2: HTMLProps<VanillaJSX.H2TagProps>;
      h3: HTMLProps<VanillaJSX.H3TagProps>;
      h4: HTMLProps<VanillaJSX.H4TagProps>;
      h5: HTMLProps<VanillaJSX.H5TagProps>;
      h6: HTMLProps<VanillaJSX.H6TagProps>;
      head: HTMLProps<VanillaJSX.HeadTagProps>;
      header: HTMLProps<VanillaJSX.HeaderTagProps>;
      hgroup: HTMLProps<VanillaJSX.HgroupTagProps>;
      hr: HTMLProps<VanillaJSX.HrTagProps>;
      html: HTMLProps<VanillaJSX.HtmlTagProps>;
      i: HTMLProps<VanillaJSX.ITagProps>;
      iframe: HTMLProps<VanillaJSX.IframeTagProps>;
      img: HTMLProps<VanillaJSX.ImgTagProps>;
      input: HTMLProps<VanillaJSX.InputTagProps>;
      ins: HTMLProps<VanillaJSX.InsTagProps>;
      kbd: HTMLProps<VanillaJSX.KbdTagProps>;
      keygen: HTMLProps<VanillaJSX.KeygenTagProps>;
      label: HTMLProps<VanillaJSX.LabelTagProps>;
      legend: HTMLProps<VanillaJSX.LegendTagProps>;
      li: HTMLProps<VanillaJSX.LiTagProps>;
      link: HTMLProps<VanillaJSX.LinkTagProps>;
      main: HTMLProps<VanillaJSX.MainTagProps>;
      map: HTMLProps<VanillaJSX.MapTagProps>;
      mark: HTMLProps<VanillaJSX.MarkTagProps>;
      menu: HTMLProps<VanillaJSX.MenuTagProps>;
      menuitem: HTMLProps<VanillaJSX.MenuitemTagProps>;
      meta: HTMLProps<VanillaJSX.MetaTagProps>;
      meter: HTMLProps<VanillaJSX.MeterTagProps>;
      nav: HTMLProps<VanillaJSX.NavTagProps>;
      noindex: HTMLProps<VanillaJSX.NoindexTagProps>;
      noscript: HTMLProps<VanillaJSX.NoscriptTagProps>;
      object: HTMLProps<VanillaJSX.ObjectTagProps>;
      ol: HTMLProps<VanillaJSX.OlTagProps>;
      optgroup: HTMLProps<VanillaJSX.OptgroupTagProps>;
      option: HTMLProps<VanillaJSX.OptionTagProps>;
      output: HTMLProps<VanillaJSX.OutputTagProps>;
      p: HTMLProps<VanillaJSX.ParagraphTagProps>;
      param: HTMLProps<VanillaJSX.ParamTagProps>;
      picture: HTMLProps<VanillaJSX.PictureTagProps>;
      pre: HTMLProps<VanillaJSX.PreTagProps>;
      progress: HTMLProps<VanillaJSX.ProgressTagProps>;
      q: HTMLProps<VanillaJSX.QTagProps>;
      rp: HTMLProps<VanillaJSX.RpTagProps>;
      rt: HTMLProps<VanillaJSX.RtTagProps>;
      ruby: HTMLProps<VanillaJSX.RubyTagProps>;
      s: HTMLProps<VanillaJSX.STagProps>;
      samp: HTMLProps<VanillaJSX.SampTagProps>;
      search: HTMLProps<VanillaJSX.SearchTagProps>;
      script: HTMLProps<VanillaJSX.ScriptTagProps>;
      section: HTMLProps<VanillaJSX.SectionTagProps>;
      select: HTMLProps<VanillaJSX.SelectTagProps>;
      slot: HTMLProps<VanillaJSX.SlotTagProps>;
      small: HTMLProps<VanillaJSX.SmallTagProps>;
      source: HTMLProps<VanillaJSX.SourceTagProps>;
      span: HTMLProps<VanillaJSX.SpanTagProps>;
      strong?: HTMLProps<VanillaJSX.StrongTagProps>;
      style: HTMLProps<VanillaJSX.StyleTagProps>;
      sub: HTMLProps<VanillaJSX.SubTagProps>;
      summary: HTMLProps<VanillaJSX.SummaryTagProps>;
      sup: HTMLProps<VanillaJSX.SupTagProps>;
      table: HTMLProps<VanillaJSX.TableTagProps>;
      tbody: HTMLProps<VanillaJSX.TbodyTagProps>;
      td: HTMLProps<VanillaJSX.TdTagProps>;
      template: HTMLProps<VanillaJSX.TemplateTagProps>;
      textarea: HTMLProps<VanillaJSX.TextareaTagProps>;
      tfoot: HTMLProps<VanillaJSX.TfootTagProps>;
      th: HTMLProps<VanillaJSX.ThTagProps>;
      thead: HTMLProps<VanillaJSX.TheadTagProps>;
      time: HTMLProps<VanillaJSX.TimeTagProps>;
      title: HTMLProps<VanillaJSX.TitleTagProps>;
      tr: HTMLProps<VanillaJSX.TrTagProps>;
      track: HTMLProps<VanillaJSX.TrackTagProps>;
      u: HTMLProps<VanillaJSX.UTagProps>;
      ul: HTMLProps<VanillaJSX.UlTagProps>;
      var: HTMLProps<VanillaJSX.VarTagProps>;
      video: HTMLProps<VanillaJSX.VideoTagProps>;
      wbr: HTMLProps<VanillaJSX.WbrTagProps>;
      webview: HTMLProps<VanillaJSX.WebviewTagProps>;

      // SVG
      svg: HTMLProps<VanillaJSX.SvgTagProps>;

      // web components
    }

    type EventHandlerFunction<E extends Event = Event> = (
      event: E,
    ) => void;

    type PropsWithChildren<P> = {
      children?: Element | Element[];
    } & P;

    interface BaseAttributes {
      children?: Element | Element[];

      accesskey?: string;
      class?: string;
      contenteditable?: AttributeBool;
      dir?: "ltr" | "rtl" | "auto";
      draggable?: AttributeBool | "auto";
      hidden?: AttributeBool;
      id?: string;
      inert?: AttributeBool;
      is?: string;
      lang?: string;
      onabort?: EventHandlerFunction<UIEvent>;
      onafterprint?: EventHandlerFunction<Event>;
      onanimationend?: EventHandlerFunction<AnimationEvent>;
      onanimationiteration?: EventHandlerFunction<AnimationEvent>;
      onanimationstart?: EventHandlerFunction<AnimationEvent>;
      onbeforeprint?: EventHandlerFunction<Event>;
      onbeforeunload?: EventHandlerFunction<BeforeUnloadEvent>;
      onblur?: EventHandlerFunction<FocusEvent>;
      oncanplay?: EventHandlerFunction<Event>;
      oncanplaythrough?: EventHandlerFunction<Event>;
      onchange?: EventHandlerFunction<Event>;
      onclick?: EventHandlerFunction<MouseEvent>;
      oncontextmenu?: EventHandlerFunction<MouseEvent>;
      oncopy?: EventHandlerFunction<ClipboardEvent>;
      oncuechange?: EventHandlerFunction<Event>;
      oncut?: EventHandlerFunction<ClipboardEvent>;
      ondblclick?: EventHandlerFunction<MouseEvent>;
      ondrag?: EventHandlerFunction<MouseEvent>;
      ondragend?: EventHandlerFunction<MouseEvent>;
      ondragenter?: EventHandlerFunction<MouseEvent>;
      ondragleave?: EventHandlerFunction<MouseEvent>;
      ondragover?: EventHandlerFunction<MouseEvent>;
      ondragstart?: EventHandlerFunction<MouseEvent>;
      ondrop?: EventHandlerFunction<MouseEvent>;
      ondurationchange?: EventHandlerFunction<Event>;
      onemptied?: EventHandlerFunction<Event>;
      onended?: EventHandlerFunction<Event>;
      onerror?: EventHandlerFunction<Event>;
      onfocus?: EventHandlerFunction<FocusEvent>;
      onfocusin?: EventHandlerFunction<FocusEvent>;
      onfocusout?: EventHandlerFunction<FocusEvent>;
      onfullscreenchange?: EventHandlerFunction<Event>;
      onfullscreenerror?: EventHandlerFunction<Event>;
      ongotpointercapture?: EventHandlerFunction<PointerEvent>;
      onhashchange?: EventHandlerFunction<HashChangeEvent>;
      oninput?: EventHandlerFunction<InputEvent>;
      oninvalid?: EventHandlerFunction<Event>;
      onkeydown?: EventHandlerFunction<KeyboardEvent>;
      onkeypress?: EventHandlerFunction<KeyboardEvent>;
      onkeyup?: EventHandlerFunction<KeyboardEvent>;
      onload?: EventHandlerFunction<Event>;
      onloadeddata?: EventHandlerFunction<Event>;
      onloadedmetadata?: EventHandlerFunction<Event>;
      onloadstart?: EventHandlerFunction<Event>;
      onlostpointercapture?: EventHandlerFunction<PointerEvent>;
      onmessage?: EventHandlerFunction<MessageEvent>;
      onmousedown?: EventHandlerFunction<MouseEvent>;
      onmouseenter?: EventHandlerFunction<MouseEvent>;
      onmouseleave?: EventHandlerFunction<MouseEvent>;
      onmousemove?: EventHandlerFunction<MouseEvent>;
      onmouseout?: EventHandlerFunction<MouseEvent>;
      onmouseover?: EventHandlerFunction<MouseEvent>;
      onmouseup?: EventHandlerFunction<MouseEvent>;
      onmousewheel?: EventHandlerFunction<WheelEvent>;
      onoffline?: EventHandlerFunction<Event>;
      ononline?: EventHandlerFunction<Event>;
      onopen?: EventHandlerFunction<Event>;
      onpagehide?: EventHandlerFunction<PageTransitionEvent>;
      onpageshow?: EventHandlerFunction<PageTransitionEvent>;
      onpaste?: EventHandlerFunction<ClipboardEvent>;
      onpause?: EventHandlerFunction<Event>;
      onplay?: EventHandlerFunction<Event>;
      onplaying?: EventHandlerFunction<Event>;
      onpointercancel?: EventHandlerFunction<PointerEvent>;
      onpointerdown?: EventHandlerFunction<PointerEvent>;
      onpointerenter?: EventHandlerFunction<PointerEvent>;
      onpointerleave?: EventHandlerFunction<PointerEvent>;
      onpointermove?: EventHandlerFunction<PointerEvent>;
      onpointerout?: EventHandlerFunction<PointerEvent>;
      onpointerover?: EventHandlerFunction<PointerEvent>;
      onpointerup?: EventHandlerFunction<PointerEvent>;
      onpopstate?: EventHandlerFunction<PopStateEvent>;
      onprogress?: EventHandlerFunction<ProgressEvent>;
      onratechange?: EventHandlerFunction<Event>;
      onreset?: EventHandlerFunction<Event>;
      onresize?: EventHandlerFunction<UIEvent>;
      onscroll?: EventHandlerFunction<UIEvent>;
      onsearch?: EventHandlerFunction<Event>;
      onseeked?: EventHandlerFunction<Event>;
      onseeking?: EventHandlerFunction<Event>;
      onselect?: EventHandlerFunction<UIEvent>;
      onshow?: EventHandlerFunction<Event>;
      onstalled?: EventHandlerFunction<Event>;
      onstorage?: EventHandlerFunction<StorageEvent>;
      onsubmit?: EventHandlerFunction<Event>;
      onsuspend?: EventHandlerFunction<Event>;
      ontimeupdate?: EventHandlerFunction<Event>;
      ontoggle?: EventHandlerFunction<Event>;
      ontouchcancel?: EventHandlerFunction<TouchEvent>;
      ontouchend?: EventHandlerFunction<TouchEvent>;
      ontouchmove?: EventHandlerFunction<TouchEvent>;
      ontouchstart?: EventHandlerFunction<TouchEvent>;
      ontransitionend?: EventHandlerFunction<TransitionEvent>;
      onunload?: EventHandlerFunction<UIEvent>;
      onvolumechange?: EventHandlerFunction<Event>;
      onwaiting?: EventHandlerFunction<Event>;
      onwheel?: EventHandlerFunction<WheelEvent>;
      role?: string;
      slot?: string;
      spellcheck?: AttributeBool;
      style?: string;
      tabindex?: string | number;
      title?: string;
      translate?: "yes" | "no";
    }
  }

  // Interfaces for HTML tags that do not have any additional attributes defined
  namespace VanillaJSX {
    interface AbbrTagProps {}
    interface AddressTagProps {}
    interface ArticleTagProps {}
    interface AsideTagProps {}
    interface BdiTagProps {}
    interface BigTagProps {}
    interface BodyTagProps {}
    interface BrTagProps {}
    interface BTagProps {}
    interface CaptionTagProps {}
    interface CiteTagProps {}
    interface CodeTagProps {}
    interface DatalistTagProps {}
    interface DdTagProps {}
    interface DfnTagProps {}
    interface DivTagProps {}
    interface DlTagProps {}
    interface DtTagProps {}
    interface EmTagProps {}
    interface FigcaptionTagProps {}
    interface FigureTagProps {}
    interface FooterTagProps {}
    interface H1TagProps {}
    interface H2TagProps {}
    interface H3TagProps {}
    interface H4TagProps {}
    interface H5TagProps {}
    interface H6TagProps {}
    interface HeaderTagProps {}
    interface HeadTagProps {}
    interface HgroupTagProps {}
    interface HrTagProps {}
    interface ITagProps {}
    interface KbdTagProps {}
    interface KeygenTagProps {}
    interface LegendTagProps {}
    interface MainTagProps {}
    interface MarkTagProps {}
    interface MenuitemTagProps {}
    interface MenuTagProps {}
    interface NavTagProps {}
    interface NoindexTagProps {}
    interface NoscriptTagProps {}
    interface ParagraphTagProps {}
    interface PictureTagProps {}
    interface PreTagProps {}
    interface RpTagProps {}
    interface RtTagProps {}
    interface RubyTagProps {}
    interface SampTagProps {}
    interface SearchTagProps {}
    interface SectionTagProps {}
    interface SlotTagProps {}
    interface SmallTagProps {}
    interface SpanTagProps {}
    interface STagProps {}
    interface StrongTagProps {}
    interface SubTagProps {}
    interface SummaryTagProps {}
    interface SupTagProps {}
    interface SvgTagProps {}
    interface TableTagProps {}
    interface TbodyTagProps {}
    interface TemplateTagProps {}
    interface TfootTagProps {}
    interface TheadTagProps {}
    interface TitleTagProps {}
    interface TrTagProps {}
    interface UlTagProps {}
    interface UTagProps {}
    interface VarTagProps {}
    interface WbrTagProps {}
    interface WebviewTagProps {}
  }
}
