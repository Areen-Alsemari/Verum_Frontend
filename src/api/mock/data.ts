import type { AgentInfo, Scenario } from '../types'

export const AGENTS: AgentInfo[] = [
  { role_key: 'predictive_health', name: 'Predictive Health', order: 1,
    description: 'Tracks health indicators and trend direction for each asset.' },
  { role_key: 'anomaly_detection', name: 'Anomaly Detection', order: 2,
    description: 'Finds readings that depart from the expected operating pattern.' },
  { role_key: 'topology_dependency', name: 'Topology & Dependency', order: 3,
    description: 'Maps which assets sit upstream and downstream of a finding.' },
  { role_key: 'historical_asset_intelligence', name: 'Historical Asset Intelligence', order: 4,
    description: 'Looks up past events and maintenance history for the same assets.' },
  { role_key: 'diagnostic_reasoning', name: 'Diagnostic Reasoning', order: 5,
    depends_on: ['predictive_health', 'anomaly_detection', 'topology_dependency', 'historical_asset_intelligence'],
    description: 'Weighs the evidence and lists competing hypotheses.' },
  { role_key: 'inspection_planning', name: 'Inspection Planning', order: 6,
    depends_on: ['diagnostic_reasoning'],
    description: 'Lists inspection options that could tell the hypotheses apart.' },
  { role_key: 'inspection_quality_documentation', name: 'Inspection Quality & Documentation', order: 7,
    depends_on: ['diagnostic_reasoning', 'inspection_planning'],
    description: 'Writes the report and checks it is complete.' },
  { role_key: 'evidence_verification_decision', name: 'Evidence Verification & Decision', order: 8,
    depends_on: ['diagnostic_reasoning', 'inspection_planning', 'inspection_quality_documentation'],
    description: 'Checks every claim against the evidence and sets the decision state.' },
]

const AGENT_OPTIONS = AGENTS.map((a) => ({ value: a.role_key, label: `${a.order}. ${a.name}` }))

export const SCENARIOS: Scenario[] = [
  {
    id: 'quiet_window',
    title: 'Quiet window',
    kind: 'normal',
    description: 'A fault-free monitoring window. Every agent should finish and nothing should be flagged.',
    expected: {
      summary: 'All agents complete, no asset flagged, decision state no_action or more_evidence_required.',
      checks: [
        'All eight agents report status complete',
        'No asset is flagged',
        'Decision state is no_action or more_evidence_required',
        'automatic_action_authorized is false',
      ],
    },
    controls: [
      { id: 'window_hours', label: 'Observation window', type: 'slider', min: 1, max: 72, step: 1, default: 24, unit: 'h',
        help: 'Length of the monitoring window handed to the agents.' },
      { id: 'noise_level', label: 'Sensor noise', type: 'slider', min: 0, max: 1, step: 0.05, default: 0.1, unit: '',
        help: 'Relative noise on the pressure and flow channels. High values degrade anomaly detection.' },
      { id: 'sensor_dropout', label: 'Sensor dropout', type: 'toggle', default: false,
        help: 'Simulate a pressure sensor that stopped reporting during the window.' },
    ],
  },
  {
    id: 'developing_fault',
    title: 'Developing fault',
    kind: 'fault',
    description: 'A pressure drop develops at one asset. Agents mostly agree on a leading hypothesis.',
    expected: {
      summary: 'The selected asset is flagged, a leading hypothesis exists, inspection options are listed, a human decides.',
      checks: [
        'Flagged asset matches the selected fault location',
        'A leading hypothesis is present',
        'At least one inspection option is listed',
        'human_decision_required is true',
      ],
    },
    controls: [
      { id: 'fault_location', label: 'Fault location', type: 'select', default: 'valve',
        options: [
          { value: 'pump', label: 'Pump' }, { value: 'valve', label: 'Valve' },
          { value: 'pipeline', label: 'Pipeline' }, { value: 'sensor', label: 'Sensor' },
        ], help: 'Where the simulated fault is injected.' },
      { id: 'pressure_drop_rate', label: 'Pressure drop rate', type: 'slider', min: 0, max: 40, step: 1, default: 12, unit: 'kPa/h',
        help: 'Below 3 the anomaly agent sees nothing unusual.' },
      { id: 'history_available', label: 'Maintenance history available', type: 'toggle', default: true,
        help: 'Turn off to withhold the history records from the historical agent.' },
    ],
  },
  {
    id: 'agent_conflict',
    title: 'Conflicting agents',
    kind: 'conflict',
    description: 'Two agents disagree. The conflict is kept visible instead of being averaged away.',
    expected: {
      summary: 'The disagreement stays visible, evidence is not fully verified, decision state more_evidence_required.',
      checks: [
        'Issue code EVIDENCE_CONFLICT is raised',
        'Both competing hypotheses are still listed',
        'Evidence verification state is conflict_unresolved',
        'Decision state is more_evidence_required',
      ],
    },
    controls: [
      { id: 'disagreeing_pair', label: 'Disagreement', type: 'select', default: 'valve_vs_sensor',
        options: [
          { value: 'valve_vs_sensor', label: 'Valve obstruction vs sensor drift' },
          { value: 'pump_vs_valve', label: 'Pump degradation vs valve obstruction' },
        ], help: 'Which two explanations the agents split on.' },
      { id: 'extra_evidence', label: 'Add a reference reading', type: 'toggle', default: false,
        help: 'Supply a reference gauge reading that settles the disagreement.' },
    ],
  },
  {
    id: 'agent_failure',
    title: 'Agent failure',
    kind: 'failure',
    description: 'One agent errors or is rejected by the runner. The pipeline carries on without its report.',
    expected: {
      summary: 'The failing agent has a null report and a visible issue code; the remaining agents still run.',
      checks: [
        'The failing agent has a null report',
        'The failure issue code is shown',
        'All other agents still ran',
        'Decision state is more_evidence_required',
      ],
    },
    controls: [
      { id: 'failing_agent', label: 'Failing agent', type: 'select', default: 'topology_dependency',
        options: AGENT_OPTIONS, help: 'Which agent fails during the run.' },
      { id: 'failure_mode', label: 'Failure mode', type: 'select', default: 'AGENT_INVALID_RESPONSE',
        options: [
          { value: 'AGENT_INVALID_RESPONSE', label: 'Invalid response (rejected by runner)' },
          { value: 'AGENT_ERROR', label: 'Agent error' },
        ], help: 'Invalid responses are rejected by the runner; errors are raised by the agent.' },
    ],
  },
]
