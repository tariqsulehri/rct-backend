import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';

const prisma = new PrismaClient();

// ─── Source: Tk-DevOps Career Progression.xlsx ──────────────────────────────

const GRADES = [
  { code: 'G13', title: 'Associate DevOps Engineer',                            level: 1, experience_years: 0,  performance_note: 'Regular Performer' },
  { code: 'G14', title: 'DevOps Engineer',                                       level: 2, experience_years: 1,  performance_note: 'Above Performer' },
  { code: 'G15', title: 'Senior DevOps Engineer',                                level: 3, experience_years: 3,  performance_note: 'Above Performer' },
  { code: 'G16', title: 'Principal DevOps Engineer',                             level: 4, experience_years: 6,  performance_note: 'Above Performer' },
  { code: 'G17', title: 'Associate Architect - Cloud and Infrastructure',        level: 5, experience_years: 9,  performance_note: 'Above Performer' },
  { code: 'G18', title: 'Architect - Cloud and Infrastructure',                  level: 6, experience_years: 12, performance_note: 'Above Performer' },
  { code: 'G19', title: 'Senior Architect - Cloud and Infrastructure',           level: 7, experience_years: 15, performance_note: 'Above Performer' },
  { code: 'G20', title: 'Solution Architect - Cloud and Infrastructure',         level: 8, experience_years: 18, performance_note: 'Above Performer' },
  { code: 'G21', title: 'Senior Solution Architect - Cloud and Infrastructure',  level: 9, experience_years: 21, performance_note: 'Above Performer' },
];

// ─── Competency Categories (skill type: Technical vs Behavioral) ─────────────
const COMPETENCY_CATEGORIES = [
  { name: 'Technical',  description: 'Hands-on technical skills and tool proficiency', color: '#3B82F6', weight: 1.0, sort_order: 1, is_active: true },  // blue
  { name: 'Behavioral', description: 'Soft skills: leadership, communication, mentoring', color: '#8B5CF6', weight: 1.0, sort_order: 2, is_active: true }, // purple
];

// ─── 12 Skill Domains — each with a color for UI visualization ───────────────
const SKILL_DOMAINS = [
  { name: 'Core DevOps',          description: 'Deployment, automation, CI/CD, containerisation and orchestration',       color: '#3B82F6' }, // blue
  { name: 'Cloud',                description: 'Cloud infrastructure, IaC, cloud architecture and multi-cloud strategy',  color: '#06B6D4' }, // cyan
  { name: 'SysOps',               description: 'System and server administration, configuration management',               color: '#10B981' }, // emerald
  { name: 'SRE',                  description: 'Observability, incident management, SLOs, reliability, DR',               color: '#F59E0B' }, // amber
  { name: 'DevSecOps',            description: 'Security controls, compliance, threat modelling and performance tuning',   color: '#EF4444' }, // red
  { name: 'FinOps',               description: 'Cloud cost optimisation and financial governance',                         color: '#84CC16' }, // lime
  { name: 'Networking',           description: 'Network design, protocols, cloud networking and security',                 color: '#EC4899' }, // pink
  { name: 'MLOps',                description: 'Machine learning pipelines, model deployment and monitoring',              color: '#A855F7' }, // purple
  { name: 'AIOps',                description: 'AI-driven operations, anomaly detection and intelligent automation',       color: '#F97316' }, // orange
  { name: 'DataOps',              description: 'Data pipeline engineering, data quality and platform operations',          color: '#14B8A6' }, // teal
  { name: 'AI-Augmented DevOps',  description: 'DevOps practices enhanced with AI/ML tooling and workflows',              color: '#6366F1' }, // indigo
  { name: 'Platform Engineering', description: 'Internal developer platforms, golden paths and self-service infrastructure', color: '#0EA5E9' }, // sky
];

// ─── Domain-Grade weight matrix (right table from career progression sheet) ──
// Weight = how much this domain contributes to overall score at each grade
const DOMAIN_GRADE_WEIGHTS: Record<string, Record<string, number>> = {
  'Cloud':                { G13: 0.30, G14: 0.55, G15: 0.75, G16: 1.00 },
  'Core DevOps':          { G13: 0.30, G14: 0.60, G15: 0.75, G16: 1.00 },
  'DevSecOps':            { G13: 0.25, G14: 0.60, G15: 0.75, G16: 0.95 },
  'FinOps':               { G13: 0.20, G14: 0.50, G15: 0.75, G16: 1.00 },
  'Networking':           { G13: 0.30, G14: 0.60, G15: 0.75, G16: 1.00 },
  'SRE':                  { G13: 0.25, G14: 0.55, G15: 0.75, G16: 1.00 },
  'SysOps':               { G13: 0.30, G14: 0.60, G15: 0.75, G16: 1.00 },
  'MLOps':                { G13: 0.30, G14: 0.60, G15: 0.75, G16: 1.00 },
  'AIOps':                { G13: 0.30, G14: 0.60, G15: 0.75, G16: 1.00 },
  'DataOps':              { G13: 0.30, G14: 0.60, G15: 0.75, G16: 1.00 },
  'AI-Augmented DevOps':  { G13: 0.30, G14: 0.60, G15: 0.75, G16: 1.00 },
  'Platform Engineering': { G13: 0.30, G14: 0.60, G15: 0.75, G16: 1.00 },
};

// ─── Competencies with category (skill type) and domains (M-to-M) ────────────
// category: 'Technical' | 'Behavioral'
// domains: array of domain names — primary domain first
const COMPETENCIES: {
  name: string;
  category: 'Technical' | 'Behavioral';
  description: string;
  is_critical: boolean;
  domains: string[];          // First entry = primary domain
  technologies: { name: string }[];
}[] = [
  // ── Core DevOps ────────────────────────────────────────────────────────────
  {
    name: 'Deployment and Delivery', category: 'Technical', is_critical: true,
    description: 'Designing and executing deployment strategies including blue/green, canary, rolling, and GitOps',
    domains: ['Core DevOps'],
    technologies: [
      { name: 'Blue/Green Deployments' },
      { name: 'Canary Releases' },
      { name: 'Rolling Deployments' },
      { name: 'GitOps Framework' },
      { name: 'AWS DevOps Engineer Professional (DOP-C02)' },
      { name: 'AZ-400: Azure DevOps Engineer Expert' },
      { name: 'GCP Professional DevOps Engineer' },
      { name: 'OCI DevOps Professional' },
      { name: 'IBM DevOps Engineer' },
      { name: 'ACP DevOps Engineer' },
    ],
  },
  {
    name: 'Automation and Scripting', category: 'Technical', is_critical: true,
    description: 'Writing and maintaining automation scripts across multiple languages',
    domains: ['Core DevOps'],
    technologies: [
      { name: 'Bash/Shell' },
      { name: 'PowerShell' },
      { name: 'Python' },
      { name: 'Golang' },
      { name: 'Ruby' },
      { name: 'Batch' },
      { name: 'Red Hat Certified Engineer (RHCE)' },
      { name: 'Red Hat Ansible Automation Specialist' },
      { name: 'Red Hat Certified Architect (RHCA)' },
      { name: 'CompTIA Linux+' },
      { name: 'CompTIA Server+' },
      { name: 'LSRE - Linux Foundation SRE Practitioner' },
    ],
  },
  {
    name: 'CI/CD', category: 'Technical', is_critical: true,
    description: 'Building, maintaining and optimising continuous integration and delivery pipelines',
    domains: ['Core DevOps'],
    technologies: [
      { name: 'GitHub Actions' },
      { name: 'Azure DevOps Pipelines' },
      { name: 'AWS Code Pipelines' },
      { name: 'GitLab CI' },
      { name: 'Jenkins' },
      { name: 'ArgoCD' },
      { name: 'FluxCD' },
      { name: 'BitBucket Pipelines' },
      { name: 'CircleCI' },
      { name: 'Harness CI/CD' },
      { name: 'Tekton' },
      { name: 'DroneCI' },
      { name: 'Spinnaker' },
      { name: 'Octopus Deploy' },
      { name: 'Bamboo' },
      { name: 'Cloud Build' },
      { name: 'Cloud Deploy' },
    ],
  },
  {
    name: 'Containerization', category: 'Technical', is_critical: true,
    description: 'Building and managing container images and container runtimes',
    domains: ['Core DevOps'],
    technologies: [
      { name: 'Docker' },
      { name: 'Podman' },
      { name: 'Buildah' },
      { name: 'CRI-O' },
      { name: 'Red Hat OpenShift Application Developer II' },
    ],
  },
  {
    name: 'Containerization and Orchestration', category: 'Technical', is_critical: true,
    description: 'Operating, scaling and securing container orchestration platforms',
    domains: ['Core DevOps'],
    technologies: [
      { name: 'Kubernetes' },
      { name: 'EKS' },
      { name: 'AKS' },
      { name: 'GKE' },
      { name: 'OpenShift' },
      { name: 'Docker Swarm' },
      { name: 'Nomad' },
      { name: 'ECS' },
      { name: 'KCNA - Kubernetes & Cloud Native Associate' },
      { name: 'CKAD - Kubernetes Application Developer' },
      { name: 'CKA - Kubernetes Administrator' },
      { name: 'CKS - Kubernetes Security Specialist' },
      { name: 'KCSA - Kubernetes Security Associate' },
      { name: 'Red Hat OpenShift Administrator' },
      { name: 'Red Hat OpenShift Expert' },
    ],
  },
  // ── Cloud ──────────────────────────────────────────────────────────────────
  {
    name: 'Infrastructure', category: 'Technical', is_critical: true,
    description: 'Designing and managing cloud and on-premises infrastructure including compute, storage, and virtualisation',
    domains: ['Cloud'],
    technologies: [
      { name: 'Compute' },
      { name: 'Storage' },
      { name: 'Databases' },
      { name: 'Networking (Infra)' },
      { name: 'Identity & Access' },
      { name: 'Serverless' },
      { name: 'On-premises' },
      { name: 'MLOps' },
      { name: 'DataOps' },
      { name: 'AIOps' },
      { name: 'CompTIA A+' },
      { name: 'VMware Data Center Virtualization Foundations' },
      { name: 'VMware Cloud Foundations' },
      { name: 'VCP - VMware Certified Professional' },
      { name: 'VCAP - Advanced Professional' },
      { name: 'VCDX - Expert / Architect' },
    ],
  },
  {
    name: 'Infrastructure as Code (IaC)', category: 'Technical', is_critical: true,
    description: 'Building modular, scalable infrastructure using IaC frameworks',
    domains: ['Cloud'],
    technologies: [
      { name: 'Terraform' },
      { name: 'Terragrunt' },
      { name: 'Pulumi' },
      { name: 'Azure Bicep' },
      { name: 'AWS CloudFormation' },
      { name: 'ARM Templates' },
      { name: 'Crossplane' },
      { name: 'Google Deployment Manager' },
      { name: 'HashiCorp Terraform Associate' },
      { name: 'HashiCorp Consul Associate' },
      { name: 'AWS Solutions Architect Associate' },
      { name: 'AZ-104 / AZ-305' },
      { name: 'GCP Professional Cloud Architect' },
      { name: 'OCI Architect Associate' },
    ],
  },
  {
    name: 'Cloud Services Architecture', category: 'Technical', is_critical: false,
    description: 'Designing scalable and resilient architectures across major cloud platforms',
    domains: ['Cloud'],
    technologies: [
      { name: 'AWS' },
      { name: 'Azure' },
      { name: 'GCP' },
      { name: 'IBM Cloud' },
      { name: 'OCI' },
      { name: 'Alibaba Cloud' },
      { name: 'DigitalOcean' },
      { name: 'Linode' },
      { name: 'Heroku' },
      { name: 'AWS Solutions Architect Professional' },
      { name: 'AZ-305: Azure Solutions Architect Expert' },
      { name: 'GCP Professional Cloud Architect (Arch)' },
      { name: 'OCI Architect Professional' },
      { name: 'IBM Cloud Architect' },
      { name: 'ACE - Alibaba Cloud Expert' },
      { name: 'ACE Cloud Native Architect' },
    ],
  },
  {
    name: 'Multi-Cloud Strategy', category: 'Technical', is_critical: false,
    description: 'Designing and governing workloads across multiple cloud providers',
    domains: ['Cloud'],
    technologies: [
      { name: 'Anthos' },
      { name: 'Azure Arc' },
      { name: 'Terraform for Multi-Cloud' },
      { name: 'AWS Outposts' },
      { name: 'Unified Kubernetes Clusters Across Clouds' },
      { name: 'Cloudflare for Multi-Cloud Networking' },
      { name: 'Multi-Cloud Governance' },
      { name: 'OCI Multicloud Architect Associate' },
      { name: 'CCSP' },
      { name: 'GCP Professional Cloud Architect (Multi-Cloud)' },
      { name: 'IBM Cloud Professional Architect' },
      { name: 'ACE - Alibaba Cloud Expert (Multi-Cloud)' },
    ],
  },
  // ── SysOps ─────────────────────────────────────────────────────────────────
  {
    name: 'Configuration Management', category: 'Technical', is_critical: false,
    description: 'Managing system configuration, drift, and secrets at scale',
    domains: ['SysOps'],
    technologies: [
      { name: 'Ansible' },
      { name: 'Puppet' },
      { name: 'Chef' },
      { name: 'SaltStack' },
      { name: 'Red Hat Ansible Automation Specialist (CM)' },
      { name: 'RHCE / RHCA' },
      { name: 'HashiCorp Vault Associate' },
      { name: 'HashiCorp Consul Associate (CM)' },
    ],
  },
  {
    name: 'System Administration', category: 'Technical', is_critical: false,
    description: 'Managing Linux and Windows operating systems, processes and filesystems',
    domains: ['SysOps'],
    technologies: [
      { name: 'Linux Administration' },
      { name: 'Windows Server Administration' },
      { name: 'Process Management' },
      { name: 'Filesystem Configuration' },
      { name: 'Package Management' },
      { name: 'systemd' },
      { name: 'top / htop' },
      { name: 'journalctl' },
      { name: 'PowerShell (SysAdmin)' },
      { name: 'CompTIA ITF+' },
      { name: 'CompTIA A+ (SysAdmin)' },
      { name: 'CompTIA Linux+ (SysAdmin)' },
      { name: 'RHCSA' },
      { name: 'RHCE (SysAdmin)' },
    ],
  },
  {
    name: 'Server Administration', category: 'Technical', is_critical: false,
    description: 'Managing physical and virtual server platforms including VMware and Hyper-V',
    domains: ['SysOps'],
    technologies: [
      { name: 'Linux Servers' },
      { name: 'Windows Servers' },
      { name: 'VMware ESXi' },
      { name: 'Proxmox' },
      { name: 'Hyper-V' },
      { name: 'Identity & Access Management' },
      { name: 'Patching' },
      { name: 'Hardening' },
      { name: 'Server Clustering' },
      { name: 'Storage Configuration' },
      { name: 'CompTIA Server+ (ServerAdmin)' },
      { name: 'VMware VCP / VCAP' },
      { name: 'RHCE (ServerAdmin)' },
    ],
  },
  // ── SRE ────────────────────────────────────────────────────────────────────
  {
    name: 'Observability (Logging, Monitoring and Tracing)', category: 'Technical', is_critical: true,
    description: 'Building observability stacks with logging, metrics, distributed tracing and dashboards',
    domains: ['SRE'],
    technologies: [
      { name: 'Prometheus' },
      { name: 'Grafana' },
      { name: 'Datadog' },
      { name: 'New Relic' },
      { name: 'CloudWatch' },
      { name: 'Azure Monitor' },
      { name: 'GCP Operations' },
      { name: 'OpenTelemetry' },
      { name: 'ELK Stack' },
      { name: 'Dynatrace' },
      { name: 'Loki' },
      { name: 'Splunk' },
      { name: 'Fluentd / Fluentbit' },
      { name: 'Jaeger' },
      { name: 'Zipkin' },
      { name: 'Nagios' },
      { name: 'Zabbix' },
      { name: 'site24x7' },
      { name: 'CrowdStrike' },
    ],
  },
  {
    name: 'Incident Management and Response', category: 'Technical', is_critical: true,
    description: 'Managing incidents, on-call rotations, runbooks and post-incident processes',
    domains: ['SRE'],
    technologies: [
      { name: 'PagerDuty' },
      { name: 'OpsGenie' },
      { name: 'VictorOps' },
      { name: 'Statuspage' },
      { name: 'Incident Command Structure (ICS)' },
      { name: 'Runbook Automation' },
      { name: 'On-call Rotations' },
      { name: 'SRE Foundation / Practitioner' },
      { name: 'IBM SRE Professional' },
      { name: 'CompTIA CySA+' },
      { name: 'GIAC Security Expert' },
    ],
  },
  {
    name: 'Error Budgets and SLOs', category: 'Technical', is_critical: false,
    description: 'Defining, managing and aligning SLOs and error budgets with business objectives',
    domains: ['SRE'],
    technologies: [
      { name: 'Nobl9' },
      { name: 'Dynatrace SLO' },
      { name: 'SRE Dashboards' },
      { name: 'Service Level Indicator Tools' },
      { name: 'SRE Book (Google)' },
      { name: 'Error Budget Policies' },
      { name: 'SLO-driven Development' },
      { name: 'LSRE - Linux Foundation SRE Practitioner (SLO)' },
      { name: 'IBM SRE Professional (SLO)' },
    ],
  },
  {
    name: 'Reliability, Performance and Scalability', category: 'Technical', is_critical: false,
    description: 'Designing systems for high availability, scalability and performance under load',
    domains: ['SRE'],
    technologies: [
      { name: 'Auto-scaling' },
      { name: 'Load Balancing' },
      { name: 'Performance Profiling' },
      { name: 'Capacity Planning' },
      { name: 'High Concurrency Tuning' },
      { name: 'k6' },
      { name: 'Datadog APM' },
      { name: 'New Relic APM' },
      { name: 'Cloud Provider Metrics' },
      { name: 'AWS Solutions Architect Professional (Reliability)' },
      { name: 'GCP Professional Cloud Architect (Reliability)' },
      { name: 'OCI Architect Professional (Reliability)' },
      { name: 'RHCA (Reliability)' },
    ],
  },
  {
    name: 'Postmortem Analysis', category: 'Technical', is_critical: false,
    description: 'Conducting blameless post-incident reviews and driving systemic improvements',
    domains: ['SRE'],
    technologies: [
      { name: 'Blameless Postmortem' },
      { name: 'RCA (Root Cause Analysis)' },
      { name: '5 Whys' },
      { name: 'Fishbone Analysis' },
      { name: 'SRE Foundation / Practitioner (Postmortem)' },
      { name: 'IBM SRE Professional (Postmortem)' },
      { name: 'LSRE - Linux Foundation SRE Practitioner (Postmortem)' },
    ],
  },
  {
    name: 'HA, DR and Backup', category: 'Technical', is_critical: false,
    description: 'Designing high-availability architectures, disaster recovery and backup strategies',
    domains: ['SRE'],
    technologies: [
      { name: 'AWS Route53 Failover' },
      { name: 'AWS Backup' },
      { name: 'Azure Site Recovery' },
      { name: 'GCP Regional/Multiregional Services' },
      { name: 'Multi-region Failover' },
      { name: 'Data Replication' },
      { name: 'RPO/RTO Design' },
      { name: 'Infrastructure Redundancy' },
      { name: 'Cloud Native Backup (Velero)' },
      { name: 'NetApp' },
      { name: 'Veeam' },
      { name: 'VCDX (DR)' },
    ],
  },
  // ── DevSecOps ──────────────────────────────────────────────────────────────
  {
    name: 'Security and Performance', category: 'Technical', is_critical: true,
    description: 'Implementing security controls, compliance, threat modelling and performance tuning',
    domains: ['DevSecOps'],
    technologies: [
      { name: 'IAM (AWS IAM, Azure AD, GCP IAM)' },
      { name: 'Zero Trust' },
      { name: 'Secrets Management (Vault, KMS, SSM)' },
      { name: 'SIEM (Splunk, QRadar, ELK SIEM)' },
      { name: 'Compliance (ISO, SOC2, CIS)' },
      { name: 'Load Testing (k6, JMeter, Locust)' },
      { name: 'Auto-scaling Frameworks' },
      { name: 'Performance Tuning (CPU, Memory, Network)' },
      { name: 'SC-900 / AZ-500 / SC-100' },
      { name: 'AWS Security Specialty' },
      { name: 'CCSP - Certified Cloud Security Professional' },
      { name: 'CISSP' },
      { name: 'CompTIA Security+' },
      { name: 'GIAC GSEC' },
      { name: 'OCI Security Professional' },
      { name: 'IBM Cloud Security Engineer' },
      { name: 'ACP Cloud Security' },
      { name: 'ACE Security Expert' },
    ],
  },
  // ── FinOps ─────────────────────────────────────────────────────────────────
  {
    name: 'Cost Optimization', category: 'Technical', is_critical: false,
    description: 'Tracking, optimising and governing cloud spend with FinOps practices',
    domains: ['FinOps'],
    technologies: [
      { name: 'AWS Cost Explorer' },
      { name: 'AWS Budgets' },
      { name: 'Azure Cost Management' },
      { name: 'GCP Billing & Budgets' },
      { name: 'FinOps Dashboards' },
      { name: 'Cloudability' },
      { name: 'CloudHealth' },
      { name: 'Right-sizing & Reservation Strategy' },
      { name: 'FinOps Foundation' },
      { name: 'Cloud Cost Governance' },
      { name: 'FinOps Practitioner (FOC)' },
      { name: 'FinOps Professional (Advanced)' },
      { name: 'AWS Solutions Architect (FinOps)' },
      { name: 'AZ-305 (FinOps)' },
    ],
  },
  // ── Networking ─────────────────────────────────────────────────────────────
  {
    name: 'Networking', category: 'Technical', is_critical: false,
    description: 'Designing and securing network infrastructure across cloud and on-premises environments',
    domains: ['Networking'],
    technologies: [
      { name: 'TCP/IP, OSI Model, Subnetting' },
      { name: 'Routing & Switching (BGP, OSPF, VLANs)' },
      { name: 'DNS, DHCP, Load Balancers' },
      { name: 'VNETs/Subnets, Peering, NSGs' },
      { name: 'Firewalls, WAF, DDoS Protection' },
      { name: 'Service Endpoints, Private Link' },
      { name: 'CompTIA Network+' },
      { name: 'AWS Advanced Networking Specialty' },
      { name: 'GCP Professional Cloud Network Engineer' },
      { name: 'VCP - Network Virtualization' },
      { name: 'ACE Network Expert' },
    ],
  },
  // ── MLOps ─────────────────────────────────────────────────────────────────
  {
    name: 'MLOps', category: 'Technical', is_critical: false,
    description: 'Machine learning pipeline design, model deployment, versioning and monitoring in production',
    domains: ['MLOps'],
    technologies: [
      { name: 'MLflow' },
      { name: 'Kubeflow' },
      { name: 'SageMaker Pipelines' },
      { name: 'Azure ML' },
      { name: 'Vertex AI' },
    ],
  },
  // ── AIOps ─────────────────────────────────────────────────────────────────
  {
    name: 'AIOps', category: 'Technical', is_critical: false,
    description: 'AI-driven IT operations including anomaly detection, predictive alerting and intelligent automation',
    domains: ['AIOps'],
    technologies: [
      { name: 'Dynatrace Davis AI' },
      { name: 'Moogsoft' },
      { name: 'BigPanda' },
    ],
  },
  // ── DataOps ───────────────────────────────────────────────────────────────
  {
    name: 'DataOps', category: 'Technical', is_critical: false,
    description: 'Data pipeline engineering, data quality, orchestration and platform operations',
    domains: ['DataOps'],
    technologies: [
      { name: 'Apache Airflow' },
      { name: 'dbt' },
      { name: 'Apache Kafka' },
      { name: 'Great Expectations' },
    ],
  },
  // ── AI-Augmented DevOps ───────────────────────────────────────────────────
  {
    name: 'AI-Augmented DevOps', category: 'Technical', is_critical: false,
    description: 'Integrating AI/ML tooling into DevOps workflows including code generation, test automation and intelligent pipelines',
    domains: ['AI-Augmented DevOps'],
    technologies: [
      { name: 'GitHub Copilot' },
      { name: 'Amazon CodeWhisperer' },
      { name: 'Tabnine' },
    ],
  },
  // ── Platform Engineering ──────────────────────────────────────────────────
  {
    name: 'Platform Engineering', category: 'Technical', is_critical: false,
    description: 'Building internal developer platforms, golden paths and self-service infrastructure to improve developer experience',
    domains: ['Platform Engineering'],
    technologies: [
      { name: 'Backstage' },
      { name: 'Port' },
      { name: 'Crossplane' },
      { name: 'Kratix' },
    ],
  },
];

// Employees from Resources sheet plus leadership test accounts
const EMPLOYEES = [
  { name: 'Abdullah Maqsood',         code: '3363', current: 'G15', target: 'G16', dept: 'DevOps' },
  { name: 'Abu Bakar Riaz',           code: '1818', current: 'G17', target: 'G18', dept: 'DevOps' },
  { name: 'Ahmad Shehanshah',         code: '2945', current: 'G14', target: 'G15', dept: 'DevOps' },
  { name: 'Ali Akbar Asif',           code: '2763', current: 'G15', target: 'G16', dept: 'DevOps' },
  { name: 'Chaudhry Muhammad Shayan', code: '3340', current: 'G14', target: 'G15', dept: 'DevOps' },
  { name: 'Danyal Azhar',             code: '1922', current: 'G15', target: 'G16', dept: 'DevOps' },
  { name: 'Farhan Hameed',            code: '2754', current: 'G15', target: 'G16', dept: 'DevOps' },
  { name: 'Hafiz Nouman Shafiq',      code: '3160', current: 'G14', target: 'G15', dept: 'DevOps' },
  { name: 'Haisum Riaz Butt',         code: '1558', current: 'G15', target: 'G16', dept: 'DevOps' },
  { name: 'Hamza Faheem',             code: '2579', current: 'G14', target: 'G15', dept: 'DevOps' },
  { name: 'Haroon',                   code: '3150', current: 'G14', target: 'G15', dept: 'DevOps' },
  { name: 'Laiba Imtiaz',             code: '2407', current: 'G15', target: 'G16', dept: 'DevOps' },
  { name: 'Mahnoor Riaz',             code: '3175', current: 'G14', target: 'G15', dept: 'DevOps' },
  { name: 'Muhammad Adeel Arshad',    code: '1139', current: 'G18', target: 'G19', dept: 'DevOps' },
  { name: 'Muhammad Bilal',           code: '2734', current: 'G14', target: 'G15', dept: 'DevOps' },
  { name: 'Muhammad Bilal Mushtaq',   code: '2749', current: 'G15', target: 'G16', dept: 'DevOps' },
  { name: 'Muhammad Dawood Seemab',   code: '2745', current: 'G13', target: 'G14', dept: 'DevOps' },
  { name: 'Muhammad Suleman',         code: '2184', current: 'G15', target: 'G16', dept: 'DevOps' },
  { name: 'Noor ul Qumar',            code: '2760', current: 'G15', target: 'G16', dept: 'DevOps' },
  { name: 'Rana Mansoor Ali',         code: '3128', current: 'G14', target: 'G15', dept: 'DevOps' },
  { name: 'Sikander Riaz',            code: '3102', current: 'G13', target: 'G14', dept: 'DevOps' },
  { name: 'Sohail Nasir',             code: '2807', current: 'G15', target: 'G16', dept: 'DevOps' },
  { name: 'Sumama Zaeem',             code: '2936', current: 'G14', target: 'G15', dept: 'DevOps' },
  { name: 'Syed Asad Raza',           code: '2689', current: 'G15', target: 'G16', dept: 'DevOps' },
  { name: 'Tamoor Ahmad',             code: '2166', current: 'G17', target: 'G18', dept: 'DevOps' },
  { name: 'Tariq Mahmood',             code: '1363', current: 'G18', target: 'G19', dept: 'DevOps' },
  { name: 'Wajahat Razi Malik',       code: '2999', current: 'G14', target: 'G15', dept: 'DevOps' },
  { name: 'Zain ul Abdeen',           code: '1392', current: 'G16', target: 'G17', dept: 'DevOps' },
  { name: 'Zerq Jehan Ahmed',         code: '3135', current: 'G15', target: 'G16', dept: 'DevOps' },
];

// Grade-Competency threshold matrix (from Matrix sheet)
const GRADE_MATRIX: Record<string, Record<string, number>> = {
  'Automation and Scripting':                        { G13: 0.30, G14: 0.60, G15: 0.75, G16: 1.00 },
  'CI/CD':                                           { G13: 0.20, G14: 0.60, G15: 0.75, G16: 1.00 },
  'Cloud Services Architecture':                    { G13: 0.30, G14: 0.60, G15: 0.75, G16: 1.00 },
  'Configuration Management':                       { G13: 0.40, G14: 0.60, G15: 0.75, G16: 1.00 },
  'Containerization':                               { G13: 0.20, G14: 0.60, G15: 0.75, G16: 1.00 },
  'Containerization and Orchestration':             { G13: 0.10, G14: 0.50, G15: 0.75, G16: 1.00 },
  'Cost Optimization':                              { G13: 0.20, G14: 0.50, G15: 0.75, G16: 1.00 },
  'Deployment and Delivery':                        { G13: 0.40, G14: 0.60, G15: 0.75, G16: 1.00 },
  'Error Budgets and SLOs':                         { G13: 0.20, G14: 0.40, G15: 0.75, G16: 1.00 },
  'HA, DR and Backup':                              { G13: 0.20, G14: 0.50, G15: 0.75, G16: 1.00 },
  'Infrastructure as Code (IaC)':                  { G13: 0.30, G14: 0.50, G15: 0.75, G16: 1.00 },
  'Incident Management and Response':               { G13: 0.20, G14: 0.50, G15: 0.75, G16: 1.00 },
  'Infrastructure':                                 { G13: 0.40, G14: 0.50, G15: 0.75, G16: 1.00 },
  'Multi-Cloud Strategy':                           { G13: 0.20, G14: 0.50, G15: 0.75, G16: 1.00 },
  'Networking':                                     { G13: 0.20, G14: 0.50, G15: 0.75, G16: 1.00 },
  'Observability (Logging, Monitoring and Tracing)': { G13: 0.25, G14: 0.50, G15: 0.75, G16: 1.00 },
  'Postmortem Analysis':                            { G13: 0.20, G14: 0.50, G15: 0.75, G16: 1.00 },
  'Reliability, Performance and Scalability':       { G13: 0.30, G14: 0.50, G15: 0.75, G16: 1.00 },
  'Security and Performance':                       { G13: 0.25, G14: 0.60, G15: 0.75, G16: 0.95 },
  'Server Administration':                          { G13: 0.30, G14: 0.60, G15: 0.75, G16: 1.00 },
  'System Administration':                          { G13: 0.30, G14: 0.60, G15: 0.75, G16: 1.00 },
  'MLOps':                                          { G13: 0.30, G14: 0.50, G15: 0.75, G16: 1.00 },
  'AIOps':                                          { G13: 0.30, G14: 0.50, G15: 0.75, G16: 1.00 },
  'DataOps':                                        { G13: 0.30, G14: 0.50, G15: 0.75, G16: 1.00 },
  'AI-Augmented DevOps':                            { G13: 0.30, G14: 0.50, G15: 0.75, G16: 1.00 },
  'Platform Engineering':                           { G13: 0.30, G14: 0.50, G15: 0.75, G16: 1.00 },
};

async function main() {
  console.log('🌱 Seeding with real data from Tk-DevOps Career Progression.xlsx\n');

  // 1. Organization
  console.log('🏢 Organization...');
  const organization = await prisma.organization.upsert({
    where: { slug: 'tkxel' },
    update: {
      name: 'tkxel',
      logo_url: '/assets/organizations/tkxel-logo.svg',
      base_url: 'https://tkxel.com',
    },
    create: {
      name: 'tkxel',
      slug: 'tkxel',
      logo_url: '/assets/organizations/tkxel-logo.svg',
      base_url: 'https://tkxel.com',
    },
  });
  console.log(`  ✅ ${organization.name}`);

  // 2. Departments
  console.log('\n🏬 Departments...');
  const departmentMap: Record<string, number> = {};
  for (const departmentName of [...new Set(EMPLOYEES.map((emp) => emp.dept))]) {
    const department = await prisma.department.upsert({
      where: { organization_id_name: { organization_id: organization.id, name: departmentName } },
      update: {},
      create: { organization_id: organization.id, name: departmentName },
    });
    departmentMap[departmentName] = department.id;
    console.log(`  ✅ ${departmentName}`);
  }

  // 3. Department Grades
  console.log('📊 DevOps Grades (G13–G21 from source workbook)...');
  const gradeMap: Record<string, Record<string, number>> = {};
  for (const [departmentName, departmentId] of Object.entries(departmentMap)) {
    gradeMap[departmentName] = {};

    if (departmentName === 'DevOps') {
      for (const g of GRADES) {
        const grade = await prisma.grade.upsert({
          where: { department_id_code: { department_id: departmentId, code: g.code } },
          update: { title: g.title, level: g.level, experience_years: g.experience_years, performance_note: g.performance_note },
          create: { ...g, department_id: departmentId },
        });
        gradeMap[departmentName][g.code] = grade.id;
      }
      console.log(`  ✅ ${departmentName}: ${GRADES.length} workbook grades`);
      continue;
    }

    const existingGrades = await prisma.grade.findMany({ where: { department_id: departmentId } });
    for (const grade of existingGrades) {
      gradeMap[departmentName][grade.code] = grade.id;
    }
    console.log(`  ↳ ${departmentName}: ${existingGrades.length} manually defined grades`);
  }

  // 4. Competency Categories (Technical / Behavioral)
  // Remove stale categories that were created before the domain/category split
  console.log('\n🏷️  Competency Categories...');
  const validCategoryNames = COMPETENCY_CATEGORIES.map(c => c.name);
  await prisma.competencyCategory.deleteMany({
    where: { name: { notIn: validCategoryNames } },
  });
  const categoryMap: Record<string, number> = {};
  for (const cat of COMPETENCY_CATEGORIES) {
    const category = await prisma.competencyCategory.upsert({
      where: { name: cat.name },
      update: { description: cat.description, color: cat.color, weight: cat.weight, sort_order: cat.sort_order, is_active: cat.is_active },
      create: cat,
    });
    categoryMap[cat.name] = category.id;
    console.log(`  ✅ ${cat.name} (${cat.color})`);
  }

  // 5. Skill Domains (with colors)
  console.log(`\n🧩 Skill Domains (${SKILL_DOMAINS.length} areas)...`);
  const domainMap: Record<string, number> = {};
  for (const d of SKILL_DOMAINS) {
    const domain = await prisma.skillDomain.upsert({
      where: { name: d.name },
      update: { description: d.description, weight: d.weight, color: d.color },
      create: d,
    });
    domainMap[d.name] = domain.id;
    console.log(`  ✅ ${d.name} (${d.color})`);
  }

  // 6. Competencies + Domain Mappings + Technologies
  console.log(`\n📋 Competencies (${COMPETENCIES.length}), Domain Mappings, and Technologies...`);
  const competencyMap: Record<string, number> = {};
  let totalTech = 0;

  for (const c of COMPETENCIES) {
    const categoryId = categoryMap[c.category];
    if (!categoryId) { console.warn(`  ⚠️  Category not found: ${c.category}`); continue; }

    // Validate all domains exist
    const domainIds = c.domains.map(dName => {
      const id = domainMap[dName];
      if (!id) console.warn(`  ⚠️  Domain not found: ${dName} for competency ${c.name}`);
      return { name: dName, id };
    }).filter(d => d.id);

    if (domainIds.length === 0) { console.warn(`  ⚠️  No valid domains for: ${c.name}`); continue; }

    // Upsert competency (no category string, no domain_id — both replaced)
    const comp = await prisma.competency.upsert({
      where: { name: c.name },
      update: { description: c.description, is_critical: c.is_critical, category_id: categoryId },
      create:  { name: c.name, description: c.description, is_critical: c.is_critical, category_id: categoryId },
    });
    competencyMap[c.name] = comp.id;

    // Upsert M-to-M domain mappings (first domain = primary)
    for (let i = 0; i < domainIds.length; i++) {
      const { id: domainId } = domainIds[i];
      await prisma.competencyDomainMap.upsert({
        where: {
          department_id_competency_id_domain_id: {
            department_id: departmentMap['DevOps'],
            competency_id: comp.id,
            domain_id: domainId,
          },
        },
        update: { is_primary: i === 0 },
        create: { department_id: departmentMap['DevOps'], competency_id: comp.id, domain_id: domainId, is_primary: i === 0 },
      });
    }

    // Upsert technologies
    for (const t of c.technologies) {
      await prisma.technology.upsert({
        where: { name_competency_id: { name: t.name, competency_id: comp.id } },
        update: {},
        create: { name: t.name, competency_id: comp.id },
      });
    }

    totalTech += c.technologies.length;
    console.log(`  ✅ ${c.name} [${c.domains.join(', ')}] (${c.category}) — ${c.technologies.length} techs`);
  }

  // 7. Competency Levels L1–L5
  console.log('\n🎯 Competency Levels (L1–L5)...');
  const LEVELS = [
    { level: 1, label: 'L1 – Awareness / Foundation',  summary: 'Understands fundamentals and basic concepts' },
    { level: 2, label: 'L2 – Working Knowledge',        summary: 'Executes standard tasks independently' },
    { level: 3, label: 'L3 – Practitioner',             summary: 'Designs solutions and builds reusable components' },
    { level: 4, label: 'L4 – Advanced / Lead',          summary: 'Leads at team level, optimises and mentors' },
    { level: 5, label: 'L5 – Expert / Architect',       summary: 'Defines org-wide standards, enterprise authority' },
  ];
  for (const [, compId] of Object.entries(competencyMap)) {
    for (const lv of LEVELS) {
      await prisma.competencyLevel.upsert({
        where: { competency_id_level: { competency_id: compId, level: lv.level } },
        update: { descriptor: lv },
        create: { competency_id: compId, level: lv.level, descriptor: lv },
      });
    }
  }
  console.log(`  ✅ ${Object.keys(competencyMap).length * 5} levels created`);

  // 8. Employees (28 real engineers)
  console.log('\n👥 Employees (28 engineers)...');
  const employeeMap: Record<string, number> = {};

  for (const emp of EMPLOYEES) {
    const currentGradeId = gradeMap[emp.dept]?.[emp.current];
    const targetGradeId  = gradeMap[emp.dept]?.[emp.target];
    if (!currentGradeId || !targetGradeId) { console.warn(`  ⚠️  Grade not found for ${emp.name}`); continue; }

    const email = `${emp.name.toLowerCase().replace(/[^a-z\s]/g, '').trim().replace(/\s+/g, '.')}@company.com`;
    const departmentId = departmentMap[emp.dept];
    const employee = await prisma.employee.upsert({
      where: { emp_code: emp.code },
      update: {
        organization_id: organization.id,
        full_name: emp.name,
        department: emp.dept,
        department_id: departmentId,
        email,
        current_grade_id: currentGradeId,
        target_grade_id: targetGradeId,
        deleted_at: null,
      },
      create: {
        organization_id: organization.id,
        emp_code: emp.code,
        full_name: emp.name,
        department: emp.dept,
        department_id: departmentId,
        email,
        current_grade_id: currentGradeId,
        target_grade_id: targetGradeId,
      },
    });
    employeeMap[emp.code] = employee.id;
    console.log(`  ✅ ${emp.code}: ${emp.name} (${emp.current} → ${emp.target})`);
  }

  // Manager relationships: G17+ are managers
  const seniorCodes = new Set(['1818', '2166', '1139', '1363', '1392']);
  const managerId1 = employeeMap['2166']; // Tamoor Ahmad G17 - manages G13-G15
  const managerId2 = employeeMap['1818']; // Abu Bakar Riaz G17 - manages G15-G16
  if (managerId1 && managerId2) {
    for (const emp of EMPLOYEES) {
      if (seniorCodes.has(emp.code)) continue;
      if (!employeeMap[emp.code]) continue;
      const mgr = ['G13', 'G14'].includes(emp.current) ? managerId1 : managerId2;
      await prisma.employee.update({ where: { id: employeeMap[emp.code] }, data: { manager_id: mgr } });
    }
    if (employeeMap['1392'] && employeeMap['1139']) {
      await prisma.employee.update({ where: { id: employeeMap['1392'] }, data: { manager_id: employeeMap['1139'] } });
    }
  }

  // 9. Grade Matrix
  console.log('\n📐 Grade-Competency Matrix...');
  const matrixGrades = ['G13', 'G14', 'G15', 'G16'];
  let matrixCount = 0;
  for (const [compName, gradeScores] of Object.entries(GRADE_MATRIX)) {
    const compId = competencyMap[compName];
    if (!compId) continue;
    for (const gradeCode of matrixGrades) {
      const gradeId   = gradeMap['DevOps']?.[gradeCode];
      const threshold = gradeScores[gradeCode];
      if (!gradeId || threshold === undefined) continue;
      await prisma.gradeMatrix.upsert({
        where:  { department_id_grade_id_competency_id: { department_id: departmentMap['DevOps'], grade_id: gradeId, competency_id: compId } },
        update: { threshold },
        create: { department_id: departmentMap['DevOps'], grade_id: gradeId, competency_id: compId, threshold },
      });
      matrixCount++;
    }
  }
  console.log(`  ✅ ${matrixCount} matrix entries`);

  // 10. Domain-Grade Weights
  console.log('\n⚖️  Domain-Grade Weights...');
  const domainGradeWeightGrades = ['G13', 'G14', 'G15', 'G16'];
  let dgwCount = 0;
  for (const [domainName, gradeWeights] of Object.entries(DOMAIN_GRADE_WEIGHTS)) {
    const domainId = domainMap[domainName];
    if (!domainId) { console.warn(`  ⚠️  Domain not found: ${domainName}`); continue; }
    for (const gradeCode of domainGradeWeightGrades) {
      const gradeId = gradeMap['DevOps']?.[gradeCode];
      const weight  = gradeWeights[gradeCode];
      if (!gradeId || weight === undefined) continue;
      await prisma.skillDomainGradeWeight.upsert({
        where:  { domain_id_grade_id: { domain_id: domainId, grade_id: gradeId } },
        update: { weight },
        create: { domain_id: domainId, grade_id: gradeId, weight },
      });
      dgwCount++;
    }
  }
  console.log(`  ✅ ${dgwCount} domain-grade weight entries`);

  // 11. Users (4 platform accounts)
  console.log('\n🔐 Users...');
  const password = await bcryptjs.hash('password123', 12);
  const users = [
    { username: '1363', role: 'ADMIN',    empCode: '1363', label: 'Tariq Mahmood G18' },
    { username: '1139', role: 'TOP_MANAGEMENT', empCode: '1139', label: 'Muhammad Adeel Arshad G18' },
    { username: '2166', role: 'MANAGER',  empCode: '2166', label: 'Tamoor Ahmad G17' },
    { username: '1818', role: 'LINE_MANAGER', empCode: '1818', label: 'Abu Bakar Riaz G17' },
    { username: '2754', role: 'ENGINEER', empCode: '2754', label: 'Farhan Hameed G15' },
    { username: '2734', role: 'ENGINEER', empCode: '2734', label: 'Muhammad Bilal G14' },
  ] as const;

  await prisma.user.updateMany({
    where: { username: '1392', role: 'ADMIN' },
    data: { is_active: false },
  });

  for (const u of users) {
    const empId = employeeMap[u.empCode];
    if (!empId) { console.warn(`  ⚠️  Employee not found for ${u.username}`); continue; }
    const role = await prisma.accessRole.upsert({
      where: { code: u.role },
      update: { is_active: true },
      create: {
        code: u.role,
        name: u.role.split('_').map((part) => part.charAt(0) + part.slice(1).toLowerCase()).join(' '),
        is_system: true,
        is_active: true,
      },
    });
    const existingEmployeeUser = await prisma.user.findUnique({ where: { employee_id: empId } });
    if (existingEmployeeUser && existingEmployeeUser.username !== u.username) {
      const existingUsernameUser = await prisma.user.findUnique({ where: { username: u.username } });
      if (existingUsernameUser && existingUsernameUser.id !== existingEmployeeUser.id) {
        await prisma.user.delete({ where: { id: existingUsernameUser.id } });
      }
      await prisma.user.update({
        where: { id: existingEmployeeUser.id },
        data: {
          username: u.username,
          password_hash: password,
          role: u.role,
          role_id: role.id,
          is_active: true,
        },
      });
      console.log(`  ✅ ${u.username} (${u.label})`);
      continue;
    }

    await prisma.user.upsert({
      where:  { username: u.username },
      update: { password_hash: password, role: u.role, role_id: role.id, employee_id: empId, is_active: true },
      create: { username: u.username, password_hash: password, role: u.role, role_id: role.id, employee_id: empId, is_active: true },
    });
    console.log(`  ✅ ${u.username} (${u.label})`);
  }

  console.log(`
✅ Seed complete!
   Grades:                ${GRADES.length}
   Competency Categories: ${COMPETENCY_CATEGORIES.length}  (Technical, Behavioral)
   Skill Domains:         ${SKILL_DOMAINS.length}  (each with color)
   Organization:          ${organization.name}
   Competencies:          ${COMPETENCIES.length}  (M-to-M domain mappings)
   Technologies:          ${totalTech}
   Employees:             ${EMPLOYEES.length}
   Users:                 4  (password: password123)
  `);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
