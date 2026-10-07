-- version 1.0

update public.runtime_component_versions
set runtime_version = '1.8',
    edge_version = 20,
    updated_at = now()
where component_key = 'ai-provider-worker';

update public.runtime_component_versions
set runtime_version = '2.0',
    edge_version = 35,
    updated_at = now()
where component_key = 'result-aggregator';
