// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

/**
 * Controls whether new fields are automatically added to the mapping.
 *
 * - `true` — new fields are indexed automatically (default)
 * - `false` — new fields are ignored
 * - `'strict'` — throws an exception if an unknown field is encountered
 * - `'runtime'` — new fields are added as runtime fields only
 */
export type DynamicMapping = true | false | 'strict' | 'runtime';

/**
 * Low-level OpenSearch field mapping definition.
 * Represents the raw JSON structure sent to the OpenSearch mapping API.
 */
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

/**
 * Configuration for the `_source` field of an index mapping.
 * Controls which fields are stored in and returned from `_source`.
 */
export interface SourceConfig {
  /** Whether `_source` is enabled. Defaults to `true`. */
  enabled?: boolean;
  /** Fields to include in `_source`. */
  includes?: string[];
  /** Fields to exclude from `_source`. */
  excludes?: string[];
}

/**
 * Index-level settings such as shard/replica counts and analysis configuration.
 * Additional custom settings can be passed via the index signature.
 */
export interface IndexMappingSettings {
  numberOfShards?: number;
  numberOfReplicas?: number;
  /** Custom analyzers, tokenizers, and filters configuration. */
  analysis?: Record<string, any>;
  /** Maximum allowed difference between `min_gram` and `max_gram` for NGram tokenizers. */
  maxNgramDiff?: number;
  [key: string]: any;
}

// ──────────────────────────────────────────────
// Field Options
// ──────────────────────────────────────────────

/**
 * Common options shared across all field types.
 */
export interface CommonFieldOptions {
  /** Whether the field should be searchable. Defaults to `true`. */
  index?: boolean;
  /** Whether to store field values in a column-stride fashion for sorting/aggregations. */
  docValues?: boolean;
  /** Whether the original field value should be stored separately. */
  store?: boolean;
  /** Value to use when the field is `null` or missing. */
  nullValue?: string | number | boolean;
  /** Copy the field value into one or more target fields. */
  copyTo?: string | string[];
  /** Multi-field definitions for alternate indexing strategies. */
  fields?: Record<string, FieldMapping>;
}

/**
 * Options specific to `text` fields.
 *
 * @example
 * ```ts
 * builder.text('title', { keyword: true, analyzer: 'standard' });
 * ```
 */
export interface TextFieldOptions extends CommonFieldOptions {
  /** When `true`, adds a `.exact` keyword sub-field. */
  keyword?: boolean;
  /** Maximum length for the keyword sub-field. Strings longer than this are not indexed. */
  ignoreAbove?: number;
  /** Analyzer to apply at index time. */
  analyzer?: string;
  /** Analyzer to apply at search time (overrides index-time analyzer). */
  searchAnalyzer?: string;
}

/**
 * Options specific to `keyword` fields.
 */
export interface KeywordFieldOptions extends CommonFieldOptions {
  /** Maximum length for the keyword. Strings longer than this are not indexed. */
  ignoreAbove?: number;
  /** Normalizer to apply to the keyword value before indexing. */
  normalizer?: string;
}

/**
 * Options specific to `date` fields.
 */
export interface DateFieldOptions extends CommonFieldOptions {
  /** Date format string (e.g. `'yyyy-MM-dd'`, `'epoch_millis'`). */
  format?: string;
}

/**
 * Options specific to numeric fields (`integer`, `long`, `float`, `double`).
 */
export interface NumericFieldOptions extends CommonFieldOptions {
  /** Whether to attempt to convert strings to numbers. Defaults to `true`. */
  coerce?: boolean;
}

/** Options for `boolean` fields. Inherits all common options. */
export type BooleanFieldOptions = CommonFieldOptions;

/**
 * Options specific to `object` fields.
 */
export interface ObjectFieldOptions {
  /** Whether the object content is indexed. Set to `false` to store without indexing. */
  enabled?: boolean;
  /** Dynamic mapping strategy for unknown sub-fields. */
  dynamic?: DynamicMapping;
}

/**
 * Options specific to `nested` fields.
 */
export interface NestedFieldOptions {
  /** Dynamic mapping strategy for unknown sub-fields. */
  dynamic?: DynamicMapping;
}

// ──────────────────────────────────────────────
// Builder
// ──────────────────────────────────────────────

/**
 * Fluent builder for constructing OpenSearch index mappings and settings.
 *
 * Produces the JSON body expected by the
 * [Create Index API](https://opensearch.org/docs/latest/api-reference/index-apis/create-index/).
 *
 * @example
 * ```ts
 * const body = createIndexMapping()
 *   .settings({ numberOfShards: 1, numberOfReplicas: 0 })
 *   .text('title', { keyword: true, analyzer: 'standard' })
 *   .keyword('status')
 *   .integer('price')
 *   .date('createdAt', { format: 'yyyy-MM-dd' })
 *   .nested('tags', (b) => b.keyword('name').float('score'))
 *   .build();
 * ```
 */
export class IndexMappingBuilder {
  private _settings: Record<string, any> | undefined;
  private _properties: Record<string, FieldMapping> = {};
  private _dynamic: DynamicMapping | undefined;
  private _source: SourceConfig | undefined;

  // ── Index-level settings ──────────────────

  /**
   * Sets index-level settings (shards, replicas, analysis, etc.).
   *
   * @param options - Index settings to apply
   */
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

  /**
   * Sets the top-level dynamic mapping strategy for the index.
   *
   * @param value - Dynamic mapping mode
   */
  dynamic(value: DynamicMapping): IndexMappingBuilder {
    this._dynamic = value;
    return this;
  }

  /**
   * Configures the `_source` field (enable/disable, includes/excludes).
   *
   * @param config - Source field configuration
   */
  source(config: SourceConfig): IndexMappingBuilder {
    this._source = config;
    return this;
  }

  // ── Field methods ─────────────────────────

  /**
   * Adds a `text` field for full-text search.
   * Optionally creates a `.exact` keyword sub-field when `keyword: true`.
   *
   * @param field - Field name
   * @param options - Text field options
   */
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

  /**
   * Adds a `keyword` field for exact-match filtering, sorting, and aggregations.
   *
   * @param field - Field name
   * @param options - Keyword field options
   */
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

  /**
   * Adds a `date` field.
   *
   * @param field - Field name
   * @param options - Date field options (e.g. custom format)
   */
  date(field: string, options?: DateFieldOptions): IndexMappingBuilder {
    const mapping: FieldMapping = { type: 'date' };

    if (options?.format) {
      mapping.format = options.format;
    }

    this.applyCommonOptions(mapping, options);
    this._properties[field] = mapping;
    return this;
  }

  /**
   * Adds a `boolean` field.
   *
   * @param field - Field name
   * @param options - Boolean field options
   */
  boolean(field: string, options?: BooleanFieldOptions): IndexMappingBuilder {
    const mapping: FieldMapping = { type: 'boolean' };

    this.applyCommonOptions(mapping, options);
    this._properties[field] = mapping;
    return this;
  }

  /**
   * Adds an `integer` field (32-bit signed).
   *
   * @param field - Field name
   * @param options - Numeric field options
   */
  integer(field: string, options?: NumericFieldOptions): IndexMappingBuilder {
    return this.numericField(field, 'integer', options);
  }

  /**
   * Adds a `long` field (64-bit signed).
   *
   * @param field - Field name
   * @param options - Numeric field options
   */
  long(field: string, options?: NumericFieldOptions): IndexMappingBuilder {
    return this.numericField(field, 'long', options);
  }

  /**
   * Adds a `float` field (single-precision 32-bit IEEE 754).
   *
   * @param field - Field name
   * @param options - Numeric field options
   */
  float(field: string, options?: NumericFieldOptions): IndexMappingBuilder {
    return this.numericField(field, 'float', options);
  }

  /**
   * Adds a `double` field (double-precision 64-bit IEEE 754).
   *
   * @param field - Field name
   * @param options - Numeric field options
   */
  double(field: string, options?: NumericFieldOptions): IndexMappingBuilder {
    return this.numericField(field, 'double', options);
  }

  // ── Structured field methods ──────────────

  /**
   * Adds a `nested` field with its own sub-mapping.
   * Nested objects are indexed as separate hidden documents,
   * allowing independent querying of each nested object.
   *
   * @param field - Field name
   * @param optionsOrBuilder - Either a builder callback or nested field options
   * @param builder - Builder callback (required when options are provided)
   *
   * @example
   * ```ts
   * // Without options
   * mapping.nested('tags', (b) => b.keyword('name').float('score'));
   *
   * // With options
   * mapping.nested('tags', { dynamic: 'strict' }, (b) => b.keyword('name'));
   * ```
   */
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

  /**
   * Adds an `object` field with its own sub-mapping.
   * Object fields are flattened into the parent document (not independently queryable).
   *
   * @param field - Field name
   * @param optionsOrBuilder - Either a builder callback or object field options
   * @param builder - Builder callback (required when options are provided)
   *
   * @example
   * ```ts
   * mapping.object('address', (b) => b.keyword('city').keyword('zip'));
   * mapping.object('metadata', { enabled: false }, (b) => b.keyword('key'));
   * ```
   */
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

  /**
   * Adds a disabled `object` field.
   * The field value is stored in `_source` but not indexed or searchable.
   *
   * @param field - Field name
   */
  disabled(field: string): IndexMappingBuilder {
    this._properties[field] = { type: 'object', enabled: false };
    return this;
  }

  /**
   * Adds a field with a custom, raw mapping definition.
   * Use this for field types not covered by the built-in methods.
   *
   * @param field - Field name
   * @param mapping - Raw OpenSearch field mapping
   */
  custom(field: string, mapping: FieldMapping): IndexMappingBuilder {
    this._properties[field] = mapping;
    return this;
  }

  // ── Build ─────────────────────────────────

  /**
   * Builds and returns the final index creation body,
   * ready to be passed to the OpenSearch Create Index API.
   *
   * @returns Object containing `mappings` (and optionally `settings`)
   */
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
    if (!options) {
      return;
    }

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

/**
 * Factory function to create a new {@link IndexMappingBuilder} instance.
 *
 * @example
 * ```ts
 * const body = createIndexMapping()
 *   .keyword('status')
 *   .text('title', { keyword: true })
 *   .build();
 * ```
 */
export const createIndexMapping = () => new IndexMappingBuilder();
