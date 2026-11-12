# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary:** gym members/clients, who use GymHub to check in, follow assigned workouts, and review their progress, membership, and payments.
- **Also served:** gym administrators/operators, who manage members, memberships, payments, access, and reports; and trainers, who assign and record training plans and monitor progress.

## Product Purpose

GymHub supports the day-to-day operation of a gym and gives its members a place to manage their own training and account. Success means members can complete their gym workflows while staff can manage commercial and training operations with role-appropriate access.

## Positioning

GymHub provides integrated commercial management for a gym, connecting member records, memberships, payments, access, and reports.

## Operating Context

- Administrators and operators handle membership enrollment, payment records, access, reporting, and member support.
- Trainers manage assigned plans and record sets, repetitions, load, and RPE.
- Members check in, view assigned routines, record workout progress, and review account information.
- The member workout is guided: it presents one exercise at a time; the member chooses `Realizado` or `Omitir`, and the decision is saved immediately. The session closes when all exercises are resolved; ending early requires confirmation and marks remaining exercises as skipped.

## Capabilities and Constraints

- The web application includes member, trainer, administrator, and operator workflows for authentication, dashboards, members, plans, attendance, progress, billing, nutrition, alerts, reports, and AI chat.
- Access is protected by role/capability checks. Authentication uses backend-managed JWT httpOnly cookies with CSRF protection for mutations.
- The frontend is a Vite, React, and TypeScript SPA connected to a Django API. PostgreSQL is hosted on Supabase; the documented production frontend is on Vercel.
- GymHub supports daily, weekly, biweekly, monthly, quarterly, and annual membership periods.
- The trainer's workout flow retains technical set, repetition, load, and RPE recording; the simplified `Realizado`/`Omitir` flow applies to members.

## Brand Commitments

- The product name is GymHub.

## Evidence on Hand

- Functional scope and architecture: [memory/PRD.md](./memory/PRD.md).
- Operational, deployment, and API context: [README.md](./README.md), [docs/OPERACION.md](./docs/OPERACION.md), and [gymhub/README.md](./gymhub/README.md).
- Existing identity assets: [docs/nueva_identidad_visual/](./docs/nueva_identidad_visual/).
- Public demo endpoints are documented in [README.md](./README.md). Do not invent testimonials, customer counts, or performance claims.

## Product Principles

- Make the member's training and account tasks clear and easy to complete.
- Keep administrative, trainer, and member actions within their intended permissions.
- Keep membership, payment, and access workflows connected and traceable.
- Preserve the distinct member and trainer workout flows.
