import { Department } from "@/types/queue";

/**
 * CASE STUDY: Massey Street Children's Hospital (MSCH), Lagos Island, Lagos State.
 *
 * Structural facts below (bed count, founding year, ownership, staff composition,
 * department list) are drawn from public sources: the hospital's own "About Us"
 * page, its Wikipedia entry, and its listing in the Lagos State Health Facility
 * Registry. See the About page in this application for the full source list.
 *
 * IMPORTANT ACADEMIC NOTE:
 * Lagos State hospitals do not publish granular, timestamped patient-arrival logs,
 * so the arrival rate (lambda) and service rate (mu) values below are NOT scraped
 * real-time hospital data. They are informed estimates, calibrated so that:
 *   1) the implied staffing (c) roughly matches MSCH's publicly known staff counts,
 *   2) the resulting utilisation (rho) values are realistic for a busy public
 *      paediatric referral hospital (i.e. some departments run hot), and
 *   3) the numbers are large/round enough to be defensible as assumptions in a
 *      final-year report rather than presented as measured ground truth.
 * This assumption is stated explicitly here and on the About page so it can be
 * cited transparently in the project's methodology/limitations section.
 */

export const HOSPITAL_PROFILE = {
    name: "Massey Street Children's Hospital",
    shortName: "MSCH",
    location: "Massey Street, Lagos Island, Lagos State, Nigeria",
    founded: 1914,
    ownership: "Lagos State Government",
    beds: 85,
    notes:
        "Opened in 1914 as Lagos's first general outpatient clinic, later Lagos's " +
        "first maternity hospital (1926), and converted to a dedicated children's " +
        "hospital in 1961 when Lagos Island Maternity Hospital opened. It is the " +
        "oldest children's hospital in the West African sub-region.",
    sources: [
        {
            label: "Massey Street Children's Hospital — Wikipedia",
            url: "https://en.wikipedia.org/wiki/Massey_Street_Children's_Hospital",
        },
        {
            label: "MSCH official About Us page",
            url: "https://msch.ng/aboutus",
        },
        {
            label: "Facility listing — Lagos Health Facility Registry / VFMatch",
            url: "https://vfmatch.org/explore/facilities/60503251542385607c928525",
        },
    ],
};

const now = new Date().toISOString();

/**
 * Seed departments. `c` (doctor count per department) is allocated against
 * MSCH's publicly reported clinical staff of 2 consultant paediatricians/
 * neonatologists, 1 senior registrar and 4 registrars (7 doctors total), plus
 * 31 nursing staff distributed across services including endocrinology,
 * orthopaedics, nutrition, obstetrics & gynaecology, cardiology, general
 * surgery and optometry.
 */
export const SEED_DEPARTMENTS: Department[] = [
    {
        id: "dept-outpatient",
        name: "General Outpatient / Paediatric Clinic",
        category: "Outpatient",
        description:
            "First point of contact for walk-in paediatric patients — triage, routine consultations and referrals.",
        lambda: 14,
        mu: 5,
        c: 3,
        nurseCount: 12,
        status: "Normal",
        createdAt: now,
    },
    {
        id: "dept-emergency",
        name: "Emergency Room",
        category: "Emergency",
        description:
            "Acute paediatric emergency care, including the hospital's outborn emergency cots.",
        lambda: 8,
        mu: 3,
        c: 2,
        nurseCount: 7,
        status: "Normal",
        createdAt: now,
    },
    {
        id: "dept-neonatal",
        name: "Neonatal & Maternity Unit",
        category: "Neonatal",
        description:
            "Outborn neonatal care with incubators and cots, linked to the Lagos Island Maternity Hospital inborn unit.",
        lambda: 5,
        mu: 2.5,
        c: 2,
        nurseCount: 6,
        status: "Normal",
        createdAt: now,
    },
    {
        id: "dept-surgery",
        name: "General Surgery",
        category: "Surgery",
        description: "Elective and emergency paediatric surgical procedures.",
        lambda: 2,
        mu: 1.8,
        c: 1,
        nurseCount: 3,
        status: "Warning",
        createdAt: now,
    },
    {
        id: "dept-specialist",
        name: "Cardiology & Specialist Clinics",
        category: "Specialist",
        description:
            "Combined specialist outpatient bloc covering cardiology, endocrinology, orthopaedics and nutrition.",
        lambda: 6,
        mu: 3,
        c: 2,
        nurseCount: 2,
        status: "Normal",
        createdAt: now,
    },
    {
        id: "dept-obgyn",
        name: "Obstetrics & Gynaecology",
        category: "Maternity",
        description:
            "Antenatal, delivery and postnatal care, run jointly with the adjoining Lagos Island Maternity Hospital.",
        lambda: 3,
        mu: 2.2,
        c: 1,
        nurseCount: 1,
        status: "Warning",
        createdAt: now,
    },
];
