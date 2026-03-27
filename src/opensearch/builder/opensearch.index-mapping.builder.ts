// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export type DynamicMapping = true | false | 'strict' | 'runtime';

export interface FieldMapping {
  type?: string;
  index?: boolean;
  doc_values?: boolean;
  store?: boolean;
  null_value?: string | number | boolean;
  copy_to?: string | string[];
  ignore_above?: number;
  analyzer?: string;
  search_analyzer?: string;
  normalizer?: string;
  format?: string;
  coerce?: boolean;
  enabled?: boolean;
  dynamic?: DynamicMapping;
  fields?: Record<string, FieldMapping>;
  properties?: Record<string, FieldMapping>;
}

export interface SourceConfig {
  enabled?: boolean;
  includes?: string[];
  excludes?: string[];
}

export interface IndexMappingSettings {
  numberOfShards?: number;
  numberOfReplicas?: number;
  analysis?: Record<string, any>;
  maxNgramDiff?: number;
  [key: string]: any;
}

// ──────────────────────────────────────────────
// Field Options
// ──────────────────────────────────────────────

export interface CommonFieldOptions {
  index?: boolean;
  docValues?: boolean;
  store?: boolean;
  nullValue?: string | number | boolean;
  copyTo?: string | string[];
  fields?: Record<string, FieldMapping>;
}

export interface TextFieldOptions extends CommonFieldOptions {
  keyword?: boolean;
  ignoreAbove?: number;
  analyzer?: string;
  searchAnalyzer?: string;
}

export interface KeywordFieldOptions extends CommonFieldOptions {
  ignoreAbove?: number;
  normalizer?: string;
}

export interface DateFieldOptions extends CommonFieldOptions {
  format?: string;
}

export interface NumericFieldOptions extends CommonFieldOptions {
  coerce?: boolean;
}

export type BooleanFieldOptions = CommonFieldOptions;

export interface ObjectFieldOptions {
  enabled?: boolean;
  dynamic?: DynamicMapping;
}

export interface NestedFieldOptions {
  dynamic?: DynamicMapping;
}

// ──────────────────────────────────────────────
// Builder
// ──────────────────────────────────────────────

export class IndexMappingBuilder {
  private _settings: Record<string, any> | undefined;
  private _properties: Record<string, FieldMapping> = {};
  private _dynamic: DynamicMapping | undefined;
  private _source: SourceConfig | undefined;

  // ── Index-level settings ──────────────────

  settings(options: IndexMappingSettings): IndexMappingBuilder {
    const {
      numberOfShards,
      numberOfReplicas,
      analysis,
      maxNgramDiff,
      ...rest
    } = options;

    this._settings = {
      index: {
        ...(numberOfShards != null && { number_of_shards: numberOfShards }),
        ...(numberOfReplicas != null && {
          number_of_replicas: numberOfReplicas,
        }),
        ...(maxNgramDiff != null && { max_ngram_diff: maxNgramDiff }),
      },
      ...(analysis && { analysis }),
      ...rest,
    };
    return this;
  }

  dynamic(value: DynamicMapping): IndexMappingBuilder {
    this._dynamic = value;
    return this;
  }

  source(config: SourceConfig): IndexMappingBuilder {
    this._source = config;
    return this;
  }

  // ── Field methods ─────────────────────────

  text(field: string, options?: TextFieldOptions): IndexMappingBuilder {
    const mapping: FieldMapping = { type: 'text' };

    if (options?.analyzer) {
      mapping.analyzer = options.analyzer;
    }
    if (options?.searchAnalyzer) {
      mapping.search_analyzer = options.searchAnalyzer;
    }
    if (options?.keyword) {
      const keywordField: FieldMapping = { type: 'keyword' };
      if (options.index === false) {
        keywordField.index = false;
      }
      if (options.ignoreAbove != null) {
        keywordField.ignore_above = options.ignoreAbove;
      }
      mapping.fields = { exact: keywordField };
    }

    this.applyCommonOptions(mapping, options);
    this._properties[field] = mapping;
    return this;
  }

  keyword(field: string, options?: KeywordFieldOptions): IndexMappingBuilder {
    const mapping: FieldMapping = { type: 'keyword' };

    if (options?.ignoreAbove != null) {
      mapping.ignore_above = options.ignoreAbove;
    }
    if (options?.normalizer) {
      mapping.normalizer = options.normalizer;
    }

    this.applyCommonOptions(mapping, options);
    this._properties[field] = mapping;
    return this;
  }

  date(field: string, options?: DateFieldOptions): IndexMappingBuilder {
    const mapping: FieldMapping = { type: 'date' };

    if (options?.format) {
      mapping.format = options.format;
    }

    this.applyCommonOptions(mapping, options);
    this._properties[field] = mapping;
    return this;
  }

  boolean(field: string, options?: BooleanFieldOptions): IndexMappingBuilder {
    const mapping: FieldMapping = { type: 'boolean' };

    this.applyCommonOptions(mapping, options);
    this._properties[field] = mapping;
    return this;
  }

  integer(field: string, options?: NumericFieldOptions): IndexMappingBuilder {
    return this.numericField(field, 'integer', options);
  }

  long(field: string, options?: NumericFieldOptions): IndexMappingBuilder {
    return this.numericField(field, 'long', options);
  }

  float(field: string, options?: NumericFieldOptions): IndexMappingBuilder {
    return this.numericField(field, 'float', options);
  }

  double(field: string, options?: NumericFieldOptions): IndexMappingBuilder {
    return this.numericField(field, 'double', options);
  }

  // ── Structured field methods ──────────────

  nested(
    field: string,
    optionsOrBuilder: ((b: IndexMappingBuilder) => void) | NestedFieldOptions,
    builder?: (b: IndexMappingBuilder) => void,
  ): IndexMappingBuilder {
    const [opts, build] = this.resolveOverload(optionsOrBuilder, builder);
    const nestedBuilder = new IndexMappingBuilder();
    build(nestedBuilder);

    const mapping: FieldMapping = {
      type: 'nested',
      properties: nestedBuilder._properties,
    };

    if ((opts as NestedFieldOptions)?.dynamic != null) {
      mapping.dynamic = (opts as NestedFieldOptions).dynamic;
    }

    this._properties[field] = mapping;
    return this;
  }

  object(
    field: string,
    optionsOrBuilder: ((b: IndexMappingBuilder) => void) | ObjectFieldOptions,
    builder?: (b: IndexMappingBuilder) => void,
  ): IndexMappingBuilder {
    const [opts, build] = this.resolveOverload(optionsOrBuilder, builder);
    const objectBuilder = new IndexMappingBuilder();
    build(objectBuilder);

    const mapping: FieldMapping = {
      type: 'object',
      properties: objectBuilder._properties,
    };

    const objectOpts = opts as ObjectFieldOptions | undefined;
    if (objectOpts?.dynamic != null) {
      mapping.dynamic = objectOpts.dynamic;
    }
    if (objectOpts?.enabled === false) {
      mapping.enabled = false;
    }

    this._properties[field] = mapping;
    return this;
  }

  disabled(field: string): IndexMappingBuilder {
    this._properties[field] = { type: 'object', enabled: false };
    return this;
  }

  custom(field: string, mapping: FieldMapping): IndexMappingBuilder {
    this._properties[field] = mapping;
    return this;
  }

  // ── Build ─────────────────────────────────

  build(): Record<string, any> {
    const mappings: Record<string, any> = {
      properties: this._properties,
    };

    if (this._dynamic != null) {
      mappings.dynamic = this._dynamic;
    }
    if (this._source) {
      mappings._source = this.buildSource();
    }

    const body: Record<string, any> = { mappings };

    if (this._settings) {
      body.settings = this._settings;
    }
    return body;
  }

  // ── Private helpers ───────────────────────

  private numericField(
    field: string,
    type: string,
    options?: NumericFieldOptions,
  ): IndexMappingBuilder {
    const mapping: FieldMapping = { type };

    if (options?.coerce === false) {
      mapping.coerce = false;
    }

    this.applyCommonOptions(mapping, options);
    this._properties[field] = mapping;
    return this;
  }

  private applyCommonOptions(
    mapping: FieldMapping,
    options?: CommonFieldOptions,
  ): void {
    if (!options) return;

    if (options.index === false && !mapping.fields?.exact) {
      mapping.index = false;
    }
    if (options.docValues === false) {
      mapping.doc_values = false;
    }
    if (options.store === true) {
      mapping.store = true;
    }
    if (options.nullValue != null) {
      mapping.null_value = options.nullValue;
    }
    if (options.copyTo != null) {
      mapping.copy_to = options.copyTo;
    }
    if (options.fields) {
      mapping.fields = { ...(mapping.fields ?? {}), ...options.fields };
    }
  }

  private buildSource(): Record<string, any> {
    const source: Record<string, any> = {};
    if (this._source!.enabled != null) {
      source.enabled = this._source!.enabled;
    }
    if (this._source!.includes) {
      source.includes = this._source!.includes;
    }
    if (this._source!.excludes) {
      source.excludes = this._source!.excludes;
    }
    return source;
  }

  private resolveOverload<T>(
    optionsOrBuilder: ((b: IndexMappingBuilder) => void) | T,
    builder?: (b: IndexMappingBuilder) => void,
  ): [T | undefined, (b: IndexMappingBuilder) => void] {
    if (typeof optionsOrBuilder === 'function') {
      return [undefined, optionsOrBuilder as (b: IndexMappingBuilder) => void];
    }
    return [optionsOrBuilder, builder!];
  }
}

export const createIndexMapping = () => new IndexMappingBuilder();
