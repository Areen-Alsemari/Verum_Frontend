import { lazy } from 'react'

/** The 3D chunk (three.js, fiber, drei) is loaded only when a 3D view is shown. */
export const Facility3D = lazy(() => import('./Facility3D'))
