# OpenRisk Incheon Data Workspace

이 폴더는 OpenRisk Incheon 경연대회용 공공데이터 작업 공간입니다.

## Structure

- `manifest/`: 데이터 출처, 다운로드 상태, 사용자 제공 필요 목록
- `raw/`: 공식 출처에서 받은 원본 파일
- `processed/`: H3 또는 분석용으로 변환한 결과
- `reports/`: 품질 점검 및 적재 리포트

원본 파일명은 아래 규칙을 따릅니다.

```text
YYYYMMDD_provider_dataset_period.ext
```

분석 결과와 화면에 표시되는 근거는 `manifest/public-data-sources.json`의 공공데이터 출처만 사용합니다.
