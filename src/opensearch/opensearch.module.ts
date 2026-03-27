import { DynamicModule, Module, ModuleMetadata } from '@nestjs/common';
import { Client } from '@opensearch-project/opensearch';
import { OpensearchDocumentService } from './service/opensearch.document.service.js';
import { OpensearchSearchService } from './service/opensearch.search.service.js';
import { OpensearchIndexService } from './service/opensearch.index.service.js';

export interface OpenSearchModuleOptions {
  node: string;
  auth?: {
    username: string;
    password: string;
  };
}

export interface OpenSearchModuleAsyncOptions extends Pick<
  ModuleMetadata,
  'imports'
> {
  useFactory: (
    ...args: any[]
  ) => Promise<OpenSearchModuleOptions> | OpenSearchModuleOptions;
  inject?: any[];
}

const SERVICES = [
  OpensearchDocumentService,
  OpensearchSearchService,
  OpensearchIndexService,
];

@Module({})
export class OpensearchModule {
  static forRoot(options: OpenSearchModuleOptions): DynamicModule {
    return {
      module: OpensearchModule,
      providers: [
        ...SERVICES,
        {
          provide: Client,
          useValue: new Client({
            node: options.node,
            ...(options.auth ? { auth: options.auth } : {}),
          }),
        },
      ],
      exports: [...SERVICES, Client],
    };
  }

  static forRootAsync(options: OpenSearchModuleAsyncOptions): DynamicModule {
    return {
      module: OpensearchModule,
      imports: options.imports ?? [],
      providers: [
        ...SERVICES,
        {
          provide: Client,
          useFactory: async (...args: any[]) => {
            const moduleOptions = await options.useFactory(...args);
            return new Client({
              node: moduleOptions.node,
              ...(moduleOptions.auth ? { auth: moduleOptions.auth } : {}),
            });
          },
          inject: options.inject ?? [],
        },
      ],
      exports: [...SERVICES, Client],
    };
  }
}
