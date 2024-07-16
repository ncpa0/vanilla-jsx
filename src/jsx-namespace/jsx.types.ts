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

import { PropsForElement } from "./prop-types/shared/props-for-element";

export {};

type WithSignals<T> = {
  [K in keyof T]: T[K] | JSX.Signal<T[K]>;
};

export type ClassName =
  | string
  | number
  | boolean
  | Array<string | JSX.Signal<string> | number | null | undefined | boolean>
  | Record<string, any>
  | JSX.Signal<Array<string | number | null | undefined | boolean>>
  | JSX.Signal<Record<string, any>>;

export type CssPropertyKey = keyof CSSStyleDeclaration;

export type StyleDict = {
  [K in CssPropertyKey]?:
    | string
    | undefined
    | JSX.Signal<string | undefined>
    | JSX.Signal<undefined>
    | JSX.Signal<string>;
};

type Values<Obj> = Obj[keyof Obj];

declare global {
  namespace JSX {
    type SignalValue = null | undefined | boolean | string | number;

    interface VJSXSignal<V> {
      add(listener: (value: V) => void): { detach(): void };
    }

    interface SupportedSignals<V> {
      default: VJSXSignal<V>;
    }

    type Signal<V = any> = Values<SupportedSignals<V>>;

    type VanillaValue =
      | Signal<any>
      | null
      | undefined
      | boolean
      | string
      | number;

    type Element = globalThis.Element;

    type Children = Element | VanillaValue | Array<Element | VanillaValue>;

    type HTMLProps<P> = BaseAttributes & WithSignals<P>;

    interface ElementChildrenAttribute {
      children?: {}; // specify children name to use
    }

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
      svg: HTMLProps<VanillaJSX.SvgTagProps>;
    }

    type EventHandlerFunction<E extends Event = Event> = (event: E) => void;

    type PropsWithChildren<P = {}> = {
      children?: Children;
    } & P;

    interface BaseAttributes {
      id?: string | JSX.Signal<string | undefined>;
      class?: ClassName;
      style?: string | StyleDict | JSX.Signal<Partial<CSSStyleDeclaration>>;
      children?: Children | Children[];
      /**
       * When true, all strings directly within this element will be
       * treated as HTML (using `innerHTML`).
       */
      unsafeHTML?: boolean;
    }
  }

  // Interfaces for HTML tags that do not have any additional attributes defined
  namespace VanillaJSX {
    interface AbbrTagProps extends PropsForElement<HTMLElement> {}
    interface AddressTagProps extends PropsForElement<HTMLElement> {}
    interface ArticleTagProps extends PropsForElement<HTMLElement> {}
    interface AsideTagProps extends PropsForElement<HTMLElement> {}
    interface BdiTagProps extends PropsForElement<HTMLElement> {}
    interface BigTagProps extends PropsForElement<HTMLElement> {}
    interface BodyTagProps extends PropsForElement<HTMLBodyElement> {}
    interface BrTagProps extends PropsForElement<HTMLBRElement> {}
    interface BTagProps extends PropsForElement<HTMLElement> {}
    interface CaptionTagProps
      extends PropsForElement<HTMLTableCaptionElement>
    {}
    interface CiteTagProps extends PropsForElement<HTMLElement> {}
    interface CodeTagProps extends PropsForElement<HTMLElement> {}
    interface DatalistTagProps extends PropsForElement<HTMLDataListElement> {}
    interface DdTagProps extends PropsForElement<HTMLElement> {}
    interface DfnTagProps extends PropsForElement<HTMLElement> {}
    interface DivTagProps extends PropsForElement<HTMLDivElement> {}
    interface DlTagProps extends PropsForElement<HTMLElement> {}
    interface DtTagProps extends PropsForElement<HTMLElement> {}
    interface EmTagProps extends PropsForElement<HTMLElement> {}
    interface FigcaptionTagProps extends PropsForElement<HTMLElement> {}
    interface FigureTagProps extends PropsForElement<HTMLElement> {}
    interface FooterTagProps extends PropsForElement<HTMLElement> {}
    interface H1TagProps extends PropsForElement<HTMLHeadingElement> {}
    interface H2TagProps extends PropsForElement<HTMLHeadingElement> {}
    interface H3TagProps extends PropsForElement<HTMLHeadingElement> {}
    interface H4TagProps extends PropsForElement<HTMLHeadingElement> {}
    interface H5TagProps extends PropsForElement<HTMLHeadingElement> {}
    interface H6TagProps extends PropsForElement<HTMLHeadingElement> {}
    interface HeaderTagProps extends PropsForElement<HTMLElement> {}
    interface HeadTagProps extends PropsForElement<HTMLHeadElement> {}
    interface HgroupTagProps extends PropsForElement<HTMLElement> {}
    interface HrTagProps extends PropsForElement<HTMLHRElement> {}
    interface ITagProps extends PropsForElement<HTMLElement> {}
    interface KbdTagProps extends PropsForElement<HTMLElement> {}
    interface KeygenTagProps extends PropsForElement<HTMLElement> {}
    interface LegendTagProps extends PropsForElement<HTMLLegendElement> {}
    interface MainTagProps extends PropsForElement<HTMLElement> {}
    interface MarkTagProps extends PropsForElement<HTMLElement> {}
    interface MenuitemTagProps extends PropsForElement<HTMLElement> {}
    interface MenuTagProps extends PropsForElement<HTMLMenuElement> {}
    interface NavTagProps extends PropsForElement<HTMLElement> {}
    interface NoindexTagProps extends PropsForElement<HTMLElement> {}
    interface NoscriptTagProps extends PropsForElement<HTMLElement> {}
    interface ParagraphTagProps extends PropsForElement<HTMLParagraphElement> {}
    interface PictureTagProps extends PropsForElement<HTMLPictureElement> {}
    interface PreTagProps extends PropsForElement<HTMLPreElement> {}
    interface RpTagProps extends PropsForElement<HTMLElement> {}
    interface RtTagProps extends PropsForElement<HTMLElement> {}
    interface RubyTagProps extends PropsForElement<HTMLElement> {}
    interface SampTagProps extends PropsForElement<HTMLElement> {}
    interface SearchTagProps extends PropsForElement<HTMLElement> {}
    interface SectionTagProps extends PropsForElement<HTMLElement> {}
    interface SlotTagProps extends PropsForElement<HTMLSlotElement> {}
    interface SmallTagProps extends PropsForElement<HTMLElement> {}
    interface SpanTagProps extends PropsForElement<HTMLSpanElement> {}
    interface STagProps extends PropsForElement<HTMLElement> {}
    interface StrongTagProps extends PropsForElement<HTMLElement> {}
    interface SubTagProps extends PropsForElement<HTMLElement> {}
    interface SummaryTagProps extends PropsForElement<HTMLElement> {}
    interface SupTagProps extends PropsForElement<HTMLElement> {}
    interface SvgTagProps extends PropsForElement<HTMLElement> {}
    interface TableTagProps extends PropsForElement<HTMLTableElement> {}
    interface TbodyTagProps extends PropsForElement<HTMLTableSectionElement> {}
    interface TemplateTagProps extends PropsForElement<HTMLTemplateElement> {}
    interface TfootTagProps extends PropsForElement<HTMLTableSectionElement> {}
    interface TheadTagProps extends PropsForElement<HTMLTableSectionElement> {}
    interface TitleTagProps extends PropsForElement<HTMLTitleElement> {}
    interface TrTagProps extends PropsForElement<HTMLTableRowElement> {}
    interface UlTagProps extends PropsForElement<HTMLUListElement> {}
    interface UTagProps extends PropsForElement<HTMLElement> {}
    interface VarTagProps extends PropsForElement<HTMLElement> {}
    interface WbrTagProps extends PropsForElement<HTMLElement> {}
    interface WebviewTagProps extends PropsForElement<HTMLElement> {}
  }
}
