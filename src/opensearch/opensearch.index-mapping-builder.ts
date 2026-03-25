export interface IndexMappingSettings {
  numberOfShards?: number;
  numberOfReplicas?: number;
  analysis?: Record<string, any>;
  maxNgramDiff?: number;
  [key: string]: any;
}

export interface TextFieldOptions {
  keyword?: boolean;
  index?: boolean;
  ignoreAbove?: number;
  analyzer?: string;
  searchAnalyzer?: string;
}

type PropertyMapping = Record<string, any>;

export class IndexMappingBuilder {
  private _settings: Record<string, any> | undefined;
  private _properties: Record<string, PropertyMapping> = {};

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

  text(field: string, options?: TextFieldOptions): IndexMappingBuilder {
    const mapping: PropertyMapping = { type: 'text' };

    if (options?.analyzer) {
      mapping.analyzer = options.analyzer;
    }
    if (options?.searchAnalyzer) {
      mapping.search_analyzer = options.searchAnalyzer;
    }
    if (options?.keyword) {
      const keywordField: PropertyMapping = { type: 'keyword' };
      if (options.index === false) {
        keywordField.index = false;
      }
      if (options.ignoreAbove != null) {
        keywordField.ignore_above = options.ignoreAbove;
      }
      mapping.fields = { exact: keywordField };
    }

    this._properties[field] = mapping;
    return this;
  }

  keyword(field: string): IndexMappingBuilder {
    this._properties[field] = { type: 'keyword' };
    return this;
  }

  date(field: string): IndexMappingBuilder {
    this._properties[field] = { type: 'date' };
    return this;
  }

  boolean(field: string): IndexMappingBuilder {
    this._properties[field] = { type: 'boolean' };
    return this;
  }

  integer(field: string): IndexMappingBuilder {
    this._properties[field] = { type: 'integer' };
    return this;
  }

  long(field: string): IndexMappingBuilder {
    this._properties[field] = { type: 'long' };
    return this;
  }

  float(field: string): IndexMappingBuilder {
    this._properties[field] = { type: 'float' };
    return this;
  }

  double(field: string): IndexMappingBuilder {
    this._properties[field] = { type: 'double' };
    return this;
  }

  nested(
    field: string,
    builder: (b: IndexMappingBuilder) => void,
  ): IndexMappingBuilder {
    const nestedBuilder = new IndexMappingBuilder();
    builder(nestedBuilder);
    this._properties[field] = {
      type: 'nested',
      properties: nestedBuilder._properties,
    };
    return this;
  }

  object(
    field: string,
    builder: (b: IndexMappingBuilder) => void,
  ): IndexMappingBuilder {
    const objectBuilder = new IndexMappingBuilder();
    builder(objectBuilder);
    this._properties[field] = {
      type: 'object',
      properties: objectBuilder._properties,
    };
    return this;
  }

  custom(field: string, mapping: Record<string, any>): IndexMappingBuilder {
    this._properties[field] = mapping;
    return this;
  }

  build(): Record<string, any> {
    const body: Record<string, any> = {
      mappings: { properties: this._properties },
    };
    if (this._settings) {
      body.settings = this._settings;
    }
    return body;
  }
}

export const createIndexMapping = () => new IndexMappingBuilder();
