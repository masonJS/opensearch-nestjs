import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [swc.vite()],
  test: {
    globals: true,
  },
});

/**
 기존에 vitest가 esbuild를 기본 트랜스포머로 사용하고 있었는데, esbuild는
 TypeScript의 emitDecoratorMetadata를 지원하지 않습니다.

 이 때문에 NestJS의 @Injectable() 데코레이터가 생성자 파라미터 타입
 메타데이터를 emit하지 못해서, OpensearchService의 constructor(private
 readonly client: Client) 에서 Client가 DI로 주입되지 않고 undefined가 되는
 문제가 있었습니다.

 실제로 이 문제 때문에 기존 deleteDocument, bulkDelete 등 service를 통해
 호출하는 테스트들이 전부 Cannot read properties of undefined (reading
 'delete') 에러로 실패하고 있었습니다.

 - @swc/core: emitDecoratorMetadata를 지원하는 트랜스포머
 - unplugin-swc: vitest에서 esbuild 대신 SWC를 사용하도록 연결하는 플러그인

 이 두 패키지를 추가하고 vitest.config.ts에 SWC 플러그인을 설정하여, 테스트
 시 데코레이터 메타데이터가 정상 emit되도록 수정한 것입니다. 이 변경으로
 기존에 깨져있던 서비스 테스트들도 함께 수정되었습니다.

 */
