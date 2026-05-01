import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell, ReferenceLine, ComposedChart, Area } from 'recharts'

// ── Données JJ Avril par commercial ──
const DATES_JJ = ['2026-04-01', '2026-04-02', '2026-04-03', '2026-04-04', '2026-04-06', '2026-04-07', '2026-04-08', '2026-04-09', '2026-04-10', '2026-04-11', '2026-04-13', '2026-04-14', '2026-04-15', '2026-04-16', '2026-04-17', '2026-04-18', '2026-04-20', '2026-04-21', '2026-04-22', '2026-04-23', '2026-04-24', '2026-04-25', '2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30']

const COMMS_JJ = {
  'Alae Elmoussaid': {
    equipe: 'Kenitra',
    rdv:     [1.0, 5.0, 3.0, 1.0, 2.0, 2.0, 4.0, 3.0, 1.0, null, 5.0, null, 1.0, null, 0.0, 1.0, 0.0, null, null, 1.0, 0.0, null, 1.0, null, null, null],
    visites: [2.0, 2.0, 0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 1.0, null, 2.0, null, 0.0, null, 2.0, 0.0, 1.0, null, null, 0.0, 1.0, null, 1.0, null, null, null],
    ventes:  [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, 0.0, null, 0.0, null, 0.0, 0.0, 0.0, null, null, 0.0, 0.0, null, 0.0, null, null, null],
    tv:      [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, 0.0, null, 0.0, null, 0.0, 0.0, 0.0, null, null, 0.0, 0.0, null, 0.0, null, null, null],
    cv_cumul:[null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  },
  'Asmaa Radouli': {
    equipe: 'Kenitra',
    rdv:     [null, null, 1.0, null, null, 1.0, null, null, 0.0, null, 1.0, null, null, null, null, 0.0, null, 2.0, null, null, null, null, null, null, null, null],
    visites: [null, null, 0.0, null, null, 0.0, null, null, 1.0, null, 0.0, null, null, null, null, 1.0, null, 1.0, null, null, null, null, null, null, null, null],
    ventes:  [null, null, 0.0, null, null, 0.0, null, null, 0.0, null, 0.0, null, null, null, null, 0.0, null, 0.0, null, null, null, null, null, null, null, null],
    tv:      [null, null, 0.0, null, null, 0.0, null, null, 0.0, null, 0.0, null, null, null, null, 0.0, null, 0.0, null, null, null, null, null, null, null, null],
    cv_cumul:[null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  },
  'Hajar Snaiki': {
    equipe: 'Kenitra',
    rdv:     [null, null, null, null, null, null, null, 2.0, null, null, null, null, null, 1.0, 2.0, null, 1.0, 1.0, 1.0, 1.0, 2.0, 2.0, null, null, null, null],
    visites: [null, null, null, null, null, null, null, 0.0, null, null, null, null, null, 0.0, 0.0, null, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, null, null, null, null],
    ventes:  [null, null, null, null, null, null, null, 0.0, null, null, null, null, null, 0.0, 0.0, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, null, null, null],
    tv:      [null, null, null, null, null, null, null, 0.0, null, null, null, null, null, 0.0, 0.0, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, null, null, null],
    cv_cumul:[null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  },
  'Hicham Mechach': {
    equipe: 'Kenitra',
    rdv:     [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 1.0, null, null, null],
    visites: [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0.0, null, null, null],
    ventes:  [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0.0, null, null, null],
    tv:      [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0.0, null, null, null],
    cv_cumul:[null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  },
  'Ismail Hammouch': {
    equipe: 'Kenitra',
    rdv:     [3.0, 4.0, 3.0, 4.0, 7.0, 3.0, 3.0, 1.0, 3.0, 3.0, 3.0, 4.0, 1.0, null, 2.0, null, 6.0, 8.0, 5.0, 2.0, 6.0, 5.0, 11.0, 10.0, 0.0, null],
    visites: [0.0, 1.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, null, 0.0, null, 0.0, 1.0, 1.0, 0.0, 0.0, 0.0, 2.0, 0.0, 1.0, null],
    ventes:  [0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, 0.0, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null],
    tv:      [0.0, 0.0, 0.0, 0.0, 100.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, 0.0, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null],
    cv_cumul:[null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  },
  'Marouane Cachchi': {
    equipe: 'Kenitra',
    rdv:     [null, 2.0, 1.0, 1.0, 1.0, 1.0, 1.0, 2.0, null, null, 0.0, null, null, null, null, null, 3.0, null, 2.0, null, 1.0, null, 2.0, 2.0, null, null],
    visites: [null, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, null, null, 1.0, null, null, null, null, null, 0.0, null, 0.0, null, 0.0, null, 0.0, 0.0, null, null],
    ventes:  [null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, null, 0.0, null, null, null, null, null, 0.0, null, 0.0, null, 0.0, null, 0.0, 0.0, null, null],
    tv:      [null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, null, 0.0, null, null, null, null, null, 0.0, null, 0.0, null, 0.0, null, 0.0, 0.0, null, null],
    cv_cumul:[null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  },
  'Meryem Elbouchikhi': {
    equipe: 'Kenitra',
    rdv:     [1.0, 4.0, 3.0, 2.0, 2.0, 3.0, 2.0, 2.0, 1.0, 1.0, 4.0, 1.0, null, 1.0, 1.0, null, 7.0, 3.0, 2.0, 1.0, 2.0, 3.0, 6.0, 2.0, null, null],
    visites: [1.0, 1.0, 0.0, 1.0, 2.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, null, 0.0, 0.0, null, 1.0, 1.0, 0.0, 0.0, 1.0, 4.0, 1.0, 0.0, null, null],
    ventes:  [0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, 0.0, 0.0, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, null],
    tv:      [0.0, 0.0, 0.0, 0.0, 50.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, 0.0, 0.0, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, null],
    cv_cumul:[null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  },
  'Nawfal Jdia': {
    equipe: 'Kenitra',
    rdv:     [1.0, 4.0, 4.0, 1.0, 2.0, 4.0, 4.0, null, 1.0, null, 1.0, 1.0, 3.0, 1.0, 1.0, null, 1.0, 0.0, null, null, null, null, 1.0, null, null, null],
    visites: [1.0, 0.0, 1.0, 1.0, 0.0, 0.0, 0.0, null, 0.0, null, 0.0, 0.0, 1.0, 0.0, 0.0, null, 0.0, 1.0, null, null, null, null, 2.0, null, null, null],
    ventes:  [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, 0.0, null, 0.0, 0.0, 0.0, 0.0, 0.0, null, 0.0, 0.0, null, null, null, null, 0.0, null, null, null],
    tv:      [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, 0.0, null, 0.0, 0.0, 0.0, 0.0, 0.0, null, 0.0, 0.0, null, null, null, null, 0.0, null, null, null],
    cv_cumul:[null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  },
  'Nissrine Irfden': {
    equipe: 'Kenitra',
    rdv:     [2.0, null, null, 1.0, 1.0, 1.0, null, null, null, 1.0, null, null, null, null, null, 0.0, null, null, 1.0, 1.0, 1.0, null, null, null, null, null],
    visites: [1.0, null, null, 0.0, 0.0, 0.0, null, null, null, 0.0, null, null, null, null, null, 1.0, null, null, 0.0, 0.0, 1.0, null, null, null, null, null],
    ventes:  [0.0, null, null, 0.0, 0.0, 0.0, null, null, null, 0.0, null, null, null, null, null, 0.0, null, null, 0.0, 0.0, 0.0, null, null, null, null, null],
    tv:      [0.0, null, null, 0.0, 0.0, 0.0, null, null, null, 0.0, null, null, null, null, null, 0.0, null, null, 0.0, 0.0, 0.0, null, null, null, null, null],
    cv_cumul:[null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  },
  'Oumaima Belbacha': {
    equipe: 'Kenitra',
    rdv:     [2.0, 6.0, 3.0, 2.0, 7.0, 3.0, 1.0, 2.0, 2.0, null, 2.0, 3.0, null, 1.0, 5.0, null, 6.0, 6.0, 5.0, 1.0, 9.0, 4.0, 14.0, 10.0, 0.0, 0.0],
    visites: [0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 1.0, 0.0, 1.0, null, 0.0, 1.0, null, 0.0, 2.0, null, 0.0, 0.0, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 2.0],
    ventes:  [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, 0.0, 0.0, null, 0.0, 0.0, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    tv:      [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, 0.0, 0.0, null, 0.0, 0.0, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
    cv_cumul:[null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  },
  'Rim Snaiki': {
    equipe: 'Kenitra',
    rdv:     [null, null, 1.0, null, null, 1.0, null, 1.0, null, null, null, null, null, null, 1.0, null, 1.0, 2.0, 1.0, 1.0, 1.0, 1.0, 1.0, 3.0, null, null],
    visites: [null, null, 0.0, null, null, 0.0, null, 0.0, null, null, null, null, null, null, 0.0, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, null, null],
    ventes:  [null, null, 0.0, null, null, 0.0, null, 0.0, null, null, null, null, null, null, 0.0, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, null],
    tv:      [null, null, 0.0, null, null, 0.0, null, 0.0, null, null, null, null, null, null, 0.0, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, null],
    cv_cumul:[null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  },
  'Salima Fikri': {
    equipe: 'Kenitra',
    rdv:     [3.0, 1.0, null, 0.0, 2.0, null, 1.0, 1.0, null, null, 1.0, null, null, 2.0, null, null, 1.0, null, 3.0, null, 2.0, 1.0, 4.0, null, null, null],
    visites: [0.0, 0.0, null, 1.0, 0.0, null, 0.0, 0.0, null, null, 1.0, null, null, 0.0, null, null, 0.0, null, 1.0, null, 0.0, 1.0, 0.0, null, null, null],
    ventes:  [0.0, 0.0, null, 0.0, 0.0, null, 0.0, 0.0, null, null, 0.0, null, null, 0.0, null, null, 0.0, null, 0.0, null, 0.0, 0.0, 0.0, null, null, null],
    tv:      [0.0, 0.0, null, 0.0, 0.0, null, 0.0, 0.0, null, null, 0.0, null, null, 0.0, null, null, 0.0, null, 0.0, null, 0.0, 0.0, 0.0, null, null, null],
    cv_cumul:[null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  },
  'Samia Ahalay': {
    equipe: 'Kenitra',
    rdv:     [1.0, 1.0, null, null, 1.0, null, null, 1.0, null, null, 1.0, null, null, 1.0, null, null, 1.0, 1.0, null, 2.0, 2.0, 5.0, 5.0, 1.0, null, null],
    visites: [0.0, 0.0, null, null, 1.0, null, null, 0.0, null, null, 1.0, null, null, 0.0, null, null, 0.0, 0.0, null, 1.0, 2.0, 0.0, 1.0, 0.0, null, null],
    ventes:  [0.0, 0.0, null, null, 1.0, null, null, 0.0, null, null, 0.0, null, null, 0.0, null, null, 0.0, 0.0, null, 0.0, 1.0, 0.0, 0.0, 0.0, null, null],
    tv:      [0.0, 0.0, null, null, 100.0, null, null, 0.0, null, null, 0.0, null, null, 0.0, null, null, 0.0, 0.0, null, 0.0, 50.0, 0.0, 0.0, 0.0, null, null],
    cv_cumul:[null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 33.3, 33.3, 33.3, 33.3, 33.3, 33.3],
  },
  'Souad Acoine': {
    equipe: 'Kenitra',
    rdv:     [1.0, 1.0, null, null, 1.0, 1.0, 1.0, 1.0, null, null, null, null, null, null, 0.0, null, null, null, 1.0, 3.0, 2.0, 1.0, null, 2.0, null, null],
    visites: [0.0, 1.0, null, null, 1.0, 0.0, 1.0, 0.0, null, null, null, null, null, null, 1.0, null, null, null, 0.0, 0.0, 2.0, 0.0, null, 0.0, null, null],
    ventes:  [0.0, 0.0, null, null, 0.0, 0.0, 0.0, 0.0, null, null, null, null, null, null, 0.0, null, null, null, 0.0, 0.0, 0.0, 0.0, null, 0.0, null, null],
    tv:      [0.0, 0.0, null, null, 0.0, 0.0, 0.0, 0.0, null, null, null, null, null, null, 0.0, null, null, null, 0.0, 0.0, 0.0, 0.0, null, 0.0, null, null],
    cv_cumul:[null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  },
  'Youssef Saadouni': {
    equipe: 'Kenitra',
    rdv:     [1.0, 1.0, 3.0, 1.0, 2.0, 1.0, 1.0, null, null, 1.0, 2.0, null, null, 1.0, null, null, null, 0.0, 1.0, 1.0, 1.0, null, null, 1.0, 0.0, 0.0],
    visites: [0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, null, null, 1.0, 1.0, null, null, 0.0, null, null, null, 1.0, 1.0, 0.0, 0.0, null, null, 1.0, 1.0, 1.0],
    ventes:  [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, null, 0.0, 0.0, null, null, 0.0, null, null, null, 0.0, 0.0, 0.0, 0.0, null, null, 0.0, 0.0, 0.0],
    tv:      [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, null, 0.0, 0.0, null, null, 0.0, null, null, null, 0.0, 0.0, 0.0, 0.0, null, null, 0.0, 0.0, 0.0],
    cv_cumul:[null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  },
  'Abdelhak Lakouissmi': {
    equipe: 'Sale',
    rdv:     [null, null, null, null, null, null, 0.0, 0.0, 5.0, 12.0, 28.0, 10.0, 1.0, 2.0, 4.0, 2.0, 4.0, 9.0, 25.0, 24.0, 13.0, 8.0, 21.0, 15.0, 0.0, 0.0],
    visites: [null, null, null, null, null, null, 4.0, 4.0, 3.0, 8.0, 7.0, 8.0, 2.0, 3.0, 0.0, 1.0, 2.0, 2.0, 1.0, 2.0, 0.0, 5.0, 6.0, 3.0, 3.0, 5.0],
    ventes:  [null, null, null, null, null, null, 0.0, 0.0, 0.0, 1.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0],
    tv:      [null, null, null, null, null, null, 0.0, 0.0, 0.0, 12.5, 0.0, 12.5, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 33.3, 20.0],
    cv_cumul:[null, null, null, null, null, null, null, null, null, null, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 50.5, 43.4],
  },
  'Khalid Amghoud': {
    equipe: 'Sale',
    rdv:     [5.0, 8.0, 10.0, 4.0, 16.0, 9.0, 7.0, 7.0, 4.0, 7.0, 7.0, 3.0, 2.0, 0.0, 4.0, 1.0, 2.0, 2.0, 1.0, 1.0, 3.0, 2.0, 2.0, 4.0, 0.0, null],
    visites: [0.0, 1.0, 0.0, 1.0, 1.0, 0.0, 1.0, 0.0, 0.0, 3.0, 2.0, 0.0, 2.0, 1.0, 0.0, 0.0, 0.0, 2.0, 0.0, 0.0, 1.0, 1.0, 2.0, 2.0, 1.0, null],
    ventes:  [0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 1.0, 1.0, null],
    tv:      [0.0, 0.0, 0.0, 100.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 50.0, 100.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 100.0, 100.0, 0.0, 50.0, 100.0, null],
    cv_cumul:[null, null, null, null, null, null, null, null, null, null, null, null, 33.3, 28.3, 28.3, 28.3, 28.3, 28.3, 28.3, 28.3, 24.7, 22.2, 22.2, 28.3, 26.4, 26.4],
  },
  'Najlaa Maarouf': {
    equipe: 'Sale',
    rdv:     [null, null, null, 0.0, 0.0, null, 0.0, 1.0, null, null, 5.0, 1.0, 2.0, 2.0, 6.0, 2.0, 6.0, 8.0, 4.0, 6.0, 8.0, 3.0, 3.0, 8.0, null, null],
    visites: [null, null, null, 1.0, 2.0, null, 1.0, 1.0, null, null, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 2.0, 0.0, 3.0, 0.0, 1.0, 2.0, 0.0, 0.0, null, null],
    ventes:  [null, null, null, 0.0, 0.0, null, 1.0, 0.0, null, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, null],
    tv:      [null, null, null, 0.0, 0.0, null, 100.0, 0.0, null, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 33.3, 0.0, 0.0, 0.0, 0.0, 0.0, null, null],
    cv_cumul:[null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 50.0, 50.0],
  },
  'Nouhaila Belhadj': {
    equipe: 'Sale',
    rdv:     [2.0, 8.0, 10.0, 0.0, 10.0, 13.0, 20.0, 22.0, 13.0, 9.0, 14.0, 10.0, 4.0, 1.0, 5.0, 2.0, 1.0, 3.0, 16.0, 11.0, 8.0, 4.0, 16.0, 10.0, null, 0.0],
    visites: [1.0, 1.0, 1.0, 2.0, 3.0, 3.0, 0.0, 5.0, 2.0, 4.0, 3.0, 2.0, 3.0, 2.0, 0.0, 0.0, 3.0, 2.0, 0.0, 2.0, 0.0, 3.0, 6.0, 4.0, null, 2.0],
    ventes:  [0.0, 0.0, 0.0, 1.0, 0.0, 2.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 2.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, 1.0],
    tv:      [0.0, 0.0, 0.0, 50.0, 0.0, 66.7, 0.0, 0.0, 0.0, 25.0, 0.0, 0.0, 33.3, 0.0, 0.0, 0.0, 66.7, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, 50.0],
    cv_cumul:[null, null, null, null, null, 14.3, 14.3, 14.3, 14.3, 36.3, 36.3, 36.3, 36.6, 36.6, 36.6, 36.6, 35.2, 35.2, 35.2, 35.2, 35.2, 35.2, 35.2, 35.2, 35.2, 32.0],
  },
  'Saad Fellah': {
    equipe: 'Sale',
    rdv:     [7.0, 15.0, 8.0, 3.0, 17.0, 28.0, 29.0, 29.0, 22.0, 16.0, 40.0, 14.0, 3.0, 1.0, 11.0, 2.0, 6.0, 14.0, 17.0, 9.0, 5.0, 6.0, 8.0, 8.0, 0.0, 0.0],
    visites: [1.0, 1.0, 0.0, 3.0, 5.0, 1.0, 1.0, 1.0, 3.0, 6.0, 10.0, 2.0, 7.0, 2.0, 0.0, 3.0, 6.0, 2.0, 3.0, 2.0, 3.0, 3.0, 4.0, 0.0, 1.0, 2.0],
    ventes:  [0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 2.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0],
    tv:      [0.0, 0.0, 0.0, 33.3, 20.0, 0.0, 0.0, 0.0, 0.0, 0.0, 10.0, 0.0, 28.6, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 33.3, 0.0, 0.0, 0.0, 0.0],
    cv_cumul:[null, null, null, null, 25.0, 25.0, 25.0, 25.0, 25.0, 25.0, 45.2, 45.2, 38.7, 38.7, 38.7, 38.7, 38.7, 38.7, 38.7, 38.7, 38.7, 35.8, 35.8, 35.8, 35.8, 35.8],
  },
  'Yasmina Souaq': {
    equipe: 'Sale',
    rdv:     [5.0, 6.0, 9.0, 1.0, 10.0, 7.0, 2.0, 4.0, 2.0, 2.0, 3.0, 1.0, 1.0, 2.0, 1.0, null, 4.0, 3.0, 1.0, 7.0, 14.0, 1.0, 6.0, 7.0, null, 0.0],
    visites: [1.0, 1.0, 1.0, 1.0, 3.0, 1.0, 0.0, 2.0, 0.0, 1.0, 1.0, 1.0, 0.0, 0.0, 0.0, null, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, null, 1.0],
    ventes:  [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, 0.0],
    tv:      [0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, 0.0],
    cv_cumul:[null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  },
}

// ── TV% mensuel + CV cumulatif par commercial ──
const COMMS_MM = {
  'Abdelhak Lakouissmi': { equipe: 'Sale', tv: [null, null, null, 5.8], cv_cumul: [null, null, null, null] },
  'Khalid Amghoud': { equipe: 'Sale', tv: [25.9, 0, 2.8, 33.3], cv_cumul: [null, null, 80.5, 62.9] },
  'Najlaa Maarouf': { equipe: 'Sale', tv: [null, null, null, 14.3], cv_cumul: [null, null, null, null] },
  'Nouhaila Belhadj': { equipe: 'Sale', tv: [0, 0, 0, 14.8], cv_cumul: [null, null, null, null] },
  'Saad Fellah': { equipe: 'Sale', tv: [22.2, 7.1, 5.3, 8.3], cv_cumul: [null, 51.5, 65.7, 62.6] },
  'Yasmina Souaq': { equipe: 'Sale', tv: [7.4, 0, 3.2, 0], cv_cumul: [null, null, 39.6, 39.6] },
  'Alae Elmoussaid': { equipe: 'Kenitra', tv: [0, 0, 15.4, 0], cv_cumul: [null, null, null, null] },
  'Ismail Hammouch': { equipe: 'Kenitra', tv: [9.1, 40, 11.1, 11.1], cv_cumul: [null, 62.9, 70.4, 72.0] },
  'Meryem Elbouchikhi': { equipe: 'Kenitra', tv: [0, 0, 0, 6.7], cv_cumul: [null, null, null, null] },
  'Samia Ahalay': { equipe: 'Kenitra', tv: [0, 100, 20, 33.3], cv_cumul: [null, null, 66.7, 68.5] },
  'Nawfal Jdia': { equipe: 'Kenitra', tv: [66.7, 0, 0, 0], cv_cumul: [null, null, null, null] },
  'Nissrine Irfden': { equipe: 'Kenitra', tv: [14.3, 33.3, 33.3, 0], cv_cumul: [null, 39.9, 33.2, 33.2] },
  'Oumaima Belbacha': { equipe: 'Kenitra', tv: [0, 0, 0, 0], cv_cumul: [null, null, null, null] },
}

// ── RDV mensuel par commercial ──
const RDV_MM = {
  'Abdelhak Lakouissmi': { equipe: 'Sale', rdv: [null, null, null, 183] },
  'Khalid Amghoud': { equipe: 'Sale', rdv: [122, 57, 212, 111] },
  'Najlaa Maarouf': { equipe: 'Sale', rdv: [null, null, null, 65] },
  'Nouhaila Belhadj': { equipe: 'Sale', rdv: [117, 114, 130, 212] },
  'Saad Fellah': { equipe: 'Sale', rdv: [45, 79, 146, 318] },
  'Yasmina Souaq': { equipe: 'Sale', rdv: [119, 64, 186, 99] },
  'Alae Elmoussaid': { equipe: 'Kenitra', rdv: [54, 37, 72, 31] },
  'Asmaa Radouli': { equipe: 'Kenitra', rdv: [53, 10, 0, 5] },
  'Hajar Snaiki': { equipe: 'Kenitra', rdv: [40, 4, 10, 13] },
  'Hicham Mechach': { equipe: 'Kenitra', rdv: [44, 3, 4, 1] },
  'Ismail Hammouch': { equipe: 'Kenitra', rdv: [63, 50, 95, 97] },
  'Marouane Cachchi': { equipe: 'Kenitra', rdv: [47, 5, 24, 19] },
  'Meryem Elbouchikhi': { equipe: 'Kenitra', rdv: [40, 14, 46, 54] },
  'Nawfal Jdia': { equipe: 'Kenitra', rdv: [40, 13, 36, 30] },
  'Nissrine Irfden': { equipe: 'Kenitra', rdv: [46, 17, 27, 9] },
  'Oumaima Belbacha': { equipe: 'Kenitra', rdv: [70, 74, 108, 94] },
  'Rim Snaiki': { equipe: 'Kenitra', rdv: [36, 8, 12, 15] },
  'Salima Fikri': { equipe: 'Kenitra', rdv: [37, 8, 29, 22] },
  'Samia Ahalay': { equipe: 'Kenitra', rdv: [38, 2, 30, 23] },
  'Souad Acoine': { equipe: 'Kenitra', rdv: [44, 33, 34, 15] },
  'Youssef Saadouni': { equipe: 'Kenitra', rdv: [null, null, null, 18] },
}

// ── Conv. Tél. mensuelle par conseillère ──
const CONV_TEL_MM = {
  'Fatima Zahraa AAKIBA': { short: 'Fatima', conv_tel: [31.7, 23.7, 27.0, 24.4], cv_cumul: [null, 14.4, 12.0, 11.8] },
  'Ghizlane ELBAKARI': { short: 'Ghizlane', conv_tel: [25.5, 19.2, 28.1, 12.5], cv_cumul: [null, 14.1, 15.4, 28.3] },
  'Hala ELAOUAD': { short: 'Hala', conv_tel: [21.4, 16.2, 21.8, 40.0], cv_cumul: [null, 13.8, 12.9, 36.3] },
  'Kaoutar HRARTI': { short: 'Kaoutar', conv_tel: [null, 19.4, 20.2, 53.8], cv_cumul: [null, null, 2.0, 51.5] },
  'Rajaa ELKHANCHAR': { short: 'Rajaa', conv_tel: [57.0, 24.1, 21.1, 14.3], cv_cumul: [null, 40.6, 47.7, 56.6] },
  'Siham IBNTABET': { short: 'Siham', conv_tel: [33.5, 0.0, 21.0, 56.3], cv_cumul: [null, null, 22.9, 39.6] },
}

const DATES_AVR = ['2026-04-02', '2026-04-03', '2026-04-04', '2026-04-06', '2026-04-07', '2026-04-08', '2026-04-09', '2026-04-10', '2026-04-11', '2026-04-13', '2026-04-14', '2026-04-15', '2026-04-16', '2026-04-17', '2026-04-18', '2026-04-20', '2026-04-21', '2026-04-22', '2026-04-23', '2026-04-24', '2026-04-25', '2026-04-27', '2026-04-28', '2026-04-29', '2026-04-30']

// ── Conv. Tél. JJ Avril par conseillère ──
const CONV_TEL_JJ = {
  'Fatima Zahraa AAKIBA': {
    conv_tel: [11.6, 16.4, null, 20.5, 27.0, 52.9, 75.0, 29.3, 91.7, 40.4, 33.3, null, 17.4, 16.7, 50.0, 30.3, 21.3, 62.5, 45.6, 42.1, 26.8, 24.4, 19.5, 25.0, 22.9],
    rdv:      [10, 12, null, 15, 10, 18, 21, 12, 11, 19, 10, null, 4, 7, 2, 10, 16, 20, 26, 24, 11, 22, 17, 7, 8],
    cv_cumul: [null, 17.1, 17.1, 22.5, 29.9, 56.5, 66.8, 63.3, 68.0, 64.2, 62.2, 62.2, 64.8, 67.1, 63.4, 62.0, 62.6, 60.5, 58.1, 56.2, 55.9, 56.0, 56.9, 56.7, 56.8],
  },
  'Ghizlane ELBAKARI': {
    conv_tel: [84.6, 127.3, 100.0, 85.0, 117.6, 70.8, 133.3, 50.0, 43.3, 84.6, 61.5, 28.6, 0.0, 57.1, 46.7, 54.5, 8.6, 77.8, 57.1, 53.7, 31.3, 30.0, 21.7, 34.5, 27.9],
    rdv:      [22, 14, 6, 17, 20, 17, 20, 4, 13, 22, 8, 8, 0, 8, 7, 12, 7, 21, 12, 22, 10, 18, 18, 10, 12],
    cv_cumul: [null, 20.2, 17.0, 17.5, 16.7, 20.2, 21.6, 28.2, 33.7, 32.3, 33.0, 38.8, 38.8, 39.1, 40.4, 40.5, 47.4, 45.8, 45.3, 45.0, 46.8, 48.5, 51.0, 51.9, 53.2],
  },
  'Hala ELAOUAD': {
    conv_tel: [34.6, 21.6, 71.4, 16.4, 60.0, 34.4, 61.1, 162.5, 75.0, 34.4, 11.8, 47.1, 35.7, 7.9, 15.4, 17.1, 100.0, 31.3, 23.1, 46.4, 14.3, 16.4, 28.6, 20.0, 13.8],
    rdv:      [9, 11, 10, 9, 6, 11, 11, 13, 12, 11, 4, 8, 5, 3, 2, 6, 10, 10, 6, 13, 4, 9, 10, 4, 4],
    cv_cumul: [null, 23.1, 49.6, 59.7, 52.7, 49.7, 46.2, 75.7, 69.6, 70.2, 76.3, 73.8, 73.2, 78.6, 81.5, 83.6, 80.4, 80.0, 80.9, 78.7, 80.8, 82.4, 82.0, 82.8, 84.4],
  },
  'Kaoutar HRARTI': {
    conv_tel: [56.5, 61.5, 42.9, 88.0, 77.8, 34.7, 68.2, 64.3, 43.5, 57.1, 56.3, 200.0, 200.0, 23.8, 75.0, 26.3, 25.0, 55.6, 36.6, 48.6, 32.6, 35.7, 18.6, 48.4, 34.1],
    rdv:      [13, 8, 3, 22, 21, 17, 15, 9, 10, 28, 9, 8, 2, 10, 3, 10, 15, 15, 15, 18, 14, 35, 16, 15, 15],
    cv_cumul: [null, 4.2, 14.7, 26.3, 24.3, 30.7, 28.2, 26.3, 27.4, 26.1, 25.1, 58.4, 65.1, 68.8, 66.5, 69.2, 71.7, 70.7, 71.4, 70.9, 71.8, 72.3, 74.4, 73.7, 74.0],
  },
  'Rajaa ELKHANCHAR': {
    conv_tel: [86.4, 72.7, 76.5, 68.6, 100.0, 146.7, 147.1, 178.6, 46.9, 164.1, 121.7, 9.4, 59.1, 26.5, 0.0, 63.6, 17.5, 57.8, 43.2, 38.2, 55.6, 40.0, 26.2, 26.5, 35.7],
    rdv:      [19, 16, 13, 35, 24, 22, 25, 25, 23, 64, 28, 5, 13, 18, 0, 21, 21, 26, 19, 13, 20, 34, 27, 18, 10],
    cv_cumul: [null, 8.6, 7.4, 8.7, 13.9, 29.0, 31.4, 35.8, 40.8, 40.3, 38.2, 48.1, 49.1, 53.7, 53.7, 53.6, 58.4, 58.4, 59.5, 60.8, 60.6, 61.5, 63.6, 65.4, 66.2],
  },
  'Siham IBNTABET': {
    conv_tel: [15.8, 200.0, 18.2, 11.1, 5.6, 7.3, 2.5, 10.0, 85.7, 26.7, 21.4, 31.3, 0.0, 5.4, 33.3, 14.0, 20.5, 14.0, 5.0, 10.3, 15.4, 14.3, 20.0, 25.0, 24.0],
    rdv:      [3, 2, 2, 3, 3, 3, 1, 2, 6, 4, 3, 5, 0, 3, 2, 7, 8, 6, 2, 4, 6, 9, 7, 5, 6],
    cv_cumul: [null, 85.4, 110.6, 130.8, 149.7, 163.6, 179.1, 186.3, 155.6, 152.9, 152.5, 147.9, 147.9, 154.0, 148.6, 150.1, 149.1, 150.2, 154.4, 156.3, 156.2, 156.4, 154.7, 151.8, 149.2],
  },
}

// ── Données figées marketing ───────────────────────────────────────────────
const MOIS_LABELS = ['Jan', 'Fev', 'Mar', 'Avr']
const FUNNEL_MM = [
  { mois: 'Jan', base_nette: 1306, rdv: 372, visites: 279, ventes: 21 },
  { mois: 'Fev', base_nette: 2279, rdv: 464, visites: 149, ventes: 8 },
  { mois: 'Mar', base_nette: 2635, rdv: 522, visites: 209, ventes: 13 },
  { mois: 'Avr', base_nette: 3226, rdv: 701, visites: 118, ventes: 20 },
]

const FUNNEL_JJ = [
  { d: '02/04', base_nette: 95, rdv: 49, visites: 9, ventes: 0 },
  { d: '03/04', base_nette: 53, rdv: 20, visites: 3, ventes: 0 },
  { d: '04/04', base_nette: 27, rdv: 13, visites: 3, ventes: 0 },
  { d: '06/04', base_nette: 66, rdv: 18, visites: 2, ventes: 1 },
  { d: '07/04', base_nette: 144, rdv: 83, visites: 17, ventes: 3 },
  { d: '08/04', base_nette: 215, rdv: 112, visites: 26, ventes: 2 },
  { d: '09/04', base_nette: 142, rdv: 70, visites: 18, ventes: 5 },
  { d: '10/04', base_nette: 66, rdv: 31, visites: 5, ventes: 0 },
  { d: '11/04', base_nette: 38, rdv: 32, visites: 10, ventes: 0 },
  { d: '13/04', base_nette: 208, rdv: 49, visites: 8, ventes: 3 },
  { d: '14/04', base_nette: 159, rdv: 11, visites: 1, ventes: 0 },
  { d: '15/04', base_nette: 3, rdv: 0, visites: 1, ventes: 3 },
  { d: '17/04', base_nette: 191, rdv: 15, visites: 0, ventes: 0 },
  { d: '20/04', base_nette: 321, rdv: 43, visites: 6, ventes: 1 },
  { d: '21/04', base_nette: 192, rdv: 16, visites: 1, ventes: 0 },
  { d: '22/04', base_nette: 208, rdv: 0, visites: 0, ventes: 1 },
  { d: '23/04', base_nette: 142, rdv: 49, visites: 2, ventes: 0 },
  { d: '24/04', base_nette: 145, rdv: 41, visites: 3, ventes: 1 },
  { d: '25/04', base_nette: 107, rdv: 0, visites: 0, ventes: 0 },
  { d: '29/04', base_nette: 72, rdv: 25, visites: 3, ventes: 0 },
  { d: '30/04', base_nette: 86, rdv: 24, visites: 0, ventes: 0 },
]

// CV JJ Avril marketing
const CV_MKT_JJ = { base_nette: null, rdv: 55.5, visites: 101.5, ventes: 251.7 }

// CV MM marketing (4 mois)
function calcCV(arr) {
  const v = arr.filter(x => x != null && x > 0)
  if (v.length < 2) return null
  const mean = v.reduce((a,b)=>a+b,0)/v.length
  if (!mean) return null
  const std = Math.sqrt(v.reduce((a,b)=>a+(b-mean)**2,0)/v.length)
  return parseFloat(((std/mean)*100).toFixed(1))
}

const CV_MKT_MM = {
  base_nette: calcCV(FUNNEL_MM.map(r=>r.base_nette)),
  rdv:        calcCV(FUNNEL_MM.map(r=>r.rdv)),
  visites:    calcCV(FUNNEL_MM.map(r=>r.visites)),
  ventes:     calcCV(FUNNEL_MM.map(r=>r.ventes)),
}

// ── Styles ─────────────────────────────────────────────────────────────────
const S = {
  card: { background: '#fff', border: '1px solid #E8E6DF', borderRadius: 12, padding: '20px 24px' },
  kpiCard: { background: '#F8F7F4', border: '1px solid #E8E6DF', borderRadius: 10, padding: '14px 18px', textAlign: 'center' },
  kpiVal: { fontSize: 24, fontWeight: 700, color: '#2C2C2C', lineHeight: 1.1 },
  kpiLabel: { fontSize: 11, color: '#8A8A7A', marginTop: 3 },
  th: { fontSize: 11, color: '#8A8A7A', fontWeight: 500, padding: '6px 10px', borderBottom: '1px solid #E8E6DF', background: '#F8F7F4', textAlign: 'left' },
  td: { fontSize: 12, color: '#2C2C2C', padding: '6px 10px', borderBottom: '1px solid #F0EEE9' },
  h3: { fontSize: 13, fontWeight: 600, color: '#2C2C2C', marginBottom: 12 },
}

const COLORS = { base_nette: '#C9A84C', rdv: '#4CAF7D', visites: '#534AB7', ventes: '#E05C5C' }
const COLOR_NAMES = { base_nette: 'Base nette', rdv: 'RDV', visites: 'Visites', ventes: 'Ventes' }
const SALE_COLORS = ['#C9A84C','#4CAF7D','#534AB7','#E05C5C','#E8A040','#8A8A7A']
const KEN_COLORS  = ['#C9A84C','#4CAF7D','#534AB7','#E05C5C','#E8A040','#8A8A7A','#1D9E75','#D85A30','#D4537E','#378ADD','#639922','#BA7517','#A32D2D','#6D2E46','#028090']

const SALE_NAMES = ['Abdelhak Lakouissmi','Khalid Amghoud','Najlaa Maarouf','Nouhaila Belhadj','Saad Fellah','Yasmina Souaq']
const KEN_NAMES  = ['Alae Elmoussaid','Asmaa Radouli','Hajar Snaiki','Hicham Mechach','Ismail Hammouch','Marouane Cachchi','Meryem Elbouchikhi','Nawfal Jdia','Nissrine Irfden','Oumaima Belbacha','Rim Snaiki','Salima Fikri','Samia Ahalay','Souad Acoine','Youssef Saadouni']
const CONS_NAMES = ['Fatima Zahraa AAKIBA','Ghizlane ELBAKARI','Hala ELAOUAD','Kaoutar HRARTI','Rajaa ELKHANCHAR','Siham IBNTABET']
const CONS_COLORS = ['#C9A84C','#4CAF7D','#534AB7','#E05C5C','#E8A040','#8A8A7A']

// ── Sub-composants ─────────────────────────────────────────────────────────
function CvBadge({ cv, small }) {
  if (cv == null) return <span style={{color:'#8A8A7A'}}>—</span>
  const color = cv <= 200 ? '#4CAF7D' : cv <= 300 ? '#E8A040' : '#E05C5C'
  return <span style={{ color, fontWeight: 600, fontSize: small ? 11 : 13 }}>{cv}%</span>
}

function TierBadge({ tier }) {
  const [color, bg] = tier===1 ? ['#4CAF7D','#E6F7EF'] : tier===2 ? ['#C9A84C','#FDF6E3'] : ['#E05C5C','#FEF0F0']
  return <span style={{ background: bg, color, border: `1px solid ${color}33`, borderRadius: 6, padding: '2px 7px', fontSize: 11, fontWeight: 600 }}>T{tier}</span>
}

function Toggle({ label, color, active, onChange }) {
  return (
    <button onClick={onChange} style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 20,
      border: `1px solid ${active ? color : '#E8E6DF'}`,
      background: active ? color + '18' : '#fff',
      color: active ? color : '#8A8A7A', fontSize: 12, cursor: 'pointer', fontWeight: active ? 500 : 400,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: active ? color : '#D0CEC7' }} />
      {label}
    </button>
  )
}

function SubTab({ label, active, onClick }) {
  return (
    <button onClick={onClick} style={{
      padding: '5px 14px', borderRadius: 16, border: `1px solid ${active ? '#534AB7' : '#E8E6DF'}`,
      background: active ? '#534AB7' : '#fff', color: active ? '#fff' : '#5A5A5A',
      fontSize: 11, fontWeight: active ? 500 : 400, cursor: 'pointer',
    }}>{label}</button>
  )
}

// ── Section Marketing ──────────────────────────────────────────────────────
function SectionMarketing() {
  const [subTab, setSubTab] = useState('mm')
  const [visible, setVisible] = useState({ base_nette: true, rdv: true, visites: true, ventes: true })
  const toggle = k => setVisible(p => ({ ...p, [k]: !p[k] }))
  const metrics = ['base_nette', 'rdv', 'visites', 'ventes']
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
        <SubTab label="Mensuel 2026" active={subTab==='mm'} onClick={() => setSubTab('mm')} />
        <SubTab label="Jour par jour — Avril" active={subTab==='jj'} onClick={() => setSubTab('jj')} />
      </div>
      {subTab === 'mm' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {metrics.map(k => <Toggle key={k} label={COLOR_NAMES[k]} color={COLORS[k]} active={visible[k]} onChange={() => toggle(k)} />)}
          </div>
          <div style={S.card}>
            <div style={S.h3}>Evolution mensuelle — Base nette / RDV / Visites / Ventes</div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={FUNNEL_MM}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 12, fill: '#5A5A5A' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8A8A7A' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E8E6DF', fontSize: 12 }} />
                {metrics.filter(k => visible[k]).map(k => (
                  <Line key={k} type="monotone" dataKey={k} name={COLOR_NAMES[k]} stroke={COLORS[k]} strokeWidth={2} dot={{ r: 4 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ ...S.card, marginTop: 14 }}>
            <div style={S.h3}>CV mensuel 2026 (4 mois)</div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {metrics.map(k => (
                <div key={k} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#8A8A7A', marginBottom: 2 }}>{COLOR_NAMES[k]}</div>
                  <CvBadge cv={CV_MKT_MM[k]} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {subTab === 'jj' && (
        <div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
            {metrics.map(k => <Toggle key={k} label={COLOR_NAMES[k]} color={COLORS[k]} active={visible[k]} onChange={() => toggle(k)} />)}
          </div>
          <div style={S.card}>
            <div style={S.h3}>Jour par jour — Avril 2026</div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={FUNNEL_JJ}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: '#5A5A5A' }} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fontSize: 11, fill: '#8A8A7A' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E8E6DF', fontSize: 12 }} />
                {metrics.filter(k => visible[k]).map(k => (
                  <Line key={k} type="monotone" dataKey={k} name={COLOR_NAMES[k]} stroke={COLORS[k]} strokeWidth={2} dot={{ r: 3 }} connectNulls />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ ...S.card, marginTop: 14 }}>
            <div style={S.h3}>CV Avril JJ</div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              {metrics.map(k => (
                <div key={k} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#8A8A7A', marginBottom: 2 }}>{COLOR_NAMES[k]}</div>
                  <CvBadge cv={CV_MKT_JJ[k]} />
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section Flux RDV ───────────────────────────────────────────────────────
function buildRdvMM(names) {
  return MOIS_LABELS.map((m, mi) => {
    const row = { mois: m }
    names.forEach(n => { row[n] = RDV_MM[n]?.rdv[mi] ?? null })
    return row
  })
}

function buildRdvJJ(names) {
  return DATES_JJ.map((d, di) => {
    const row = { d: d.slice(8) + '/' + d.slice(5,7) }
    names.forEach(n => { row[n] = COMMS_JJ[n]?.rdv[di] ?? null })
    return row
  })
}

function SectionFluxRDV() {
  const [subTab, setSubTab] = useState('mm')
  const [equipe, setEquipe] = useState('Sale')
  const names = equipe === 'Sale' ? SALE_NAMES : KEN_NAMES
  const colors = equipe === 'Sale' ? SALE_COLORS : KEN_COLORS
  const dataMM = buildRdvMM(names)
  const dataJJ = buildRdvJJ(names)
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <SubTab label="Mensuel" active={subTab==='mm'} onClick={() => setSubTab('mm')} />
        <SubTab label="Jour par jour — Avril" active={subTab==='jj'} onClick={() => setSubTab('jj')} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {['Sale','Kenitra'].map(e => <SubTab key={e} label={e==='Sale'?'Equipe Sale':'Equipe Kenitra'} active={equipe===e} onClick={() => setEquipe(e)} />)}
        </div>
      </div>
      <div style={S.card}>
        <div style={S.h3}>RDV par commercial — {subTab==='mm' ? 'Jan → Avr 2026' : 'Jour par jour Avril 2026'}</div>
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={subTab==='mm' ? dataMM : dataJJ}>
            <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" vertical={false} />
            <XAxis dataKey={subTab==='mm' ? 'mois' : 'd'} tick={{ fontSize: subTab==='jj' ? 10 : 12, fill: '#5A5A5A' }} axisLine={false} tickLine={false} interval={subTab==='jj' ? 3 : 0} />
            <YAxis tick={{ fontSize: 11, fill: '#8A8A7A' }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E8E6DF', fontSize: 11 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            {names.map((n, i) => (
              <Line key={n} type="monotone" dataKey={n} stroke={colors[i % colors.length]} strokeWidth={1.5} dot={false} connectNulls name={n.split(' ')[0]} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ ...S.card, marginTop: 14 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={S.th}>Commercial</th>
              {(subTab==='mm' ? MOIS_LABELS : DATES_JJ.map(d => d.slice(8)+'/'+d.slice(5,7))).map(h => (
                <th key={h} style={{ ...S.th, textAlign: 'right', fontSize: 10 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {names.map((n, i) => (
              <tr key={n}>
                <td style={{ ...S.td, color: colors[i % colors.length], fontWeight: 500, fontSize: 11 }}>{n}</td>
                {(subTab==='mm' ? RDV_MM[n]?.rdv : DATES_JJ.map((d,di) => COMMS_JJ[n]?.rdv[di])).map((v, j) => (
                  <td key={j} style={{ ...S.td, textAlign: 'right', fontSize: 11 }}>{v ?? '—'}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Section Perf Commerciale ──────────────────────────────────────────────
function SectionPerfComm() {
  const [subTab, setSubTab] = useState('mm')
  const [equipe, setEquipe] = useState('Sale')
  const [selComm, setSelComm] = useState('Saad Fellah')
  const names = equipe === 'Sale' ? SALE_NAMES : KEN_NAMES
  const colors = equipe === 'Sale' ? SALE_COLORS : KEN_COLORS

  const dataMM = MOIS_LABELS.map((m, mi) => {
    const row = { mois: m }
    names.forEach(n => {
      row[n + '_tv'] = COMMS_MM[n]?.tv[mi] ?? null
      row[n + '_cv'] = COMMS_MM[n]?.cv_cumul[mi] ?? null
    })
    return row
  })

  const dataJJ = DATES_JJ.map((d, di) => ({
    d: d.slice(8)+'/'+d.slice(5,7),
    tv: COMMS_JJ[selComm]?.tv[di] ?? null,
    cv: COMMS_JJ[selComm]?.cv_cumul[di] ?? null,
  }))

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <SubTab label="Mensuel" active={subTab==='mm'} onClick={() => setSubTab('mm')} />
        <SubTab label="Jour par jour — Avril" active={subTab==='jj'} onClick={() => setSubTab('jj')} />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {['Sale','Kenitra'].map(e => <SubTab key={e} label={e==='Sale'?'Equipe Sale':'Equipe Kenitra'} active={equipe===e} onClick={() => { setEquipe(e); setSelComm(e==='Sale'?'Saad Fellah':'Ismail Hammouch') }} />)}
        </div>
      </div>

      {subTab === 'mm' && (
        <div>
          <div style={S.card}>
            <div style={S.h3}>TV% mensuel par commercial</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dataMM}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 12, fill: '#5A5A5A' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8A8A7A' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E8E6DF', fontSize: 11 }} formatter={v => v != null ? v+'%' : '—'} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {names.map((n, i) => (
                  <Line key={n} type="monotone" dataKey={n+'_tv'} stroke={colors[i % colors.length]} strokeWidth={1.5} dot={{ r: 3 }} connectNulls name={n.split(' ')[0]} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ ...S.card, marginTop: 14 }}>
            <div style={S.h3}>CV cumulatif TV% — par commercial (Jan → Avr)</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {names.filter(n => COMMS_MM[n]).map((n, i) => {
                const tvArr = COMMS_MM[n].tv.filter(v => v != null)
                const cvFinal = COMMS_MM[n].cv_cumul[3]
                return (
                  <div key={n} style={{ background: '#F8F7F4', borderRadius: 8, padding: '10px 14px', borderLeft: `3px solid ${colors[i % colors.length]}` }}>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{n}</div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                      <div><div style={{ fontSize: 10, color: '#8A8A7A' }}>TV% Avr</div><div style={{ fontWeight: 700, color: colors[i%colors.length], fontSize: 16 }}>{COMMS_MM[n].tv[3] ?? '—'}%</div></div>
                      <div><div style={{ fontSize: 10, color: '#8A8A7A' }}>CV cumulatif</div><CvBadge cv={cvFinal} /></div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {subTab === 'jj' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {names.map((n, i) => (
              <button key={n} onClick={() => setSelComm(n)} style={{
                padding: '4px 12px', borderRadius: 16, border: `1px solid ${selComm===n ? colors[i%colors.length] : '#E8E6DF'}`,
                background: selComm===n ? colors[i%colors.length]+'18' : '#fff',
                color: selComm===n ? colors[i%colors.length] : '#5A5A5A', fontSize: 11, cursor: 'pointer', fontWeight: selComm===n ? 500 : 400,
              }}>{n.split(' ')[0]}</button>
            ))}
          </div>
          <div style={S.card}>
            <div style={S.h3}>{selComm} — TV% journalier + CV cumulatif</div>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={dataJJ}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: '#5A5A5A' }} axisLine={false} tickLine={false} interval={3} />
                <YAxis yAxisId="tv" tick={{ fontSize: 11, fill: '#8A8A7A' }} axisLine={false} tickLine={false} unit="%" />
                <YAxis yAxisId="cv" orientation="right" tick={{ fontSize: 11, fill: '#E05C5C' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E8E6DF', fontSize: 11 }} formatter={v => v != null ? v+'%' : '—'} />
                <Bar yAxisId="tv" dataKey="tv" name="TV% jour" fill="#C9A84C" radius={[3,3,0,0]} opacity={0.7} />
                <Line yAxisId="cv" type="monotone" dataKey="cv" name="CV cumulatif" stroke="#E05C5C" strokeWidth={2} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section Efficacité Conseillères ────────────────────────────────────────
function SectionEffConseillere() {
  const [subTab, setSubTab] = useState('mm')
  const [selCons, setSelCons] = useState('Fatima Zahraa AAKIBA')

  const dataMM = MOIS_LABELS.map((m, mi) => {
    const row = { mois: m }
    CONS_NAMES.forEach(n => { row[n] = CONV_TEL_MM[n]?.conv_tel[mi] ?? null })
    return row
  })

  const cvMmData = MOIS_LABELS.map((m, mi) => {
    const row = { mois: m }
    CONS_NAMES.forEach(n => { row[n] = CONV_TEL_MM[n]?.cv_cumul[mi] ?? null })
    return row
  })

  const dataJJ = DATES_AVR.map((d, di) => ({
    d: d.slice(8)+'/'+d.slice(5,7),
    ct: CONV_TEL_JJ[selCons]?.conv_tel[di] ?? null,
    rdv: CONV_TEL_JJ[selCons]?.rdv[di] ?? null,
    cv: CONV_TEL_JJ[selCons]?.cv_cumul[di] ?? null,
  }))

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <SubTab label="Mensuel 2026" active={subTab==='mm'} onClick={() => setSubTab('mm')} />
        <SubTab label="Jour par jour — Avril" active={subTab==='jj'} onClick={() => setSubTab('jj')} />
      </div>

      {subTab === 'mm' && (
        <div>
          <div style={S.card}>
            <div style={S.h3}>Conv. Tél. mensuelle par conseillere (Jan → Avr)</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dataMM}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 12, fill: '#5A5A5A' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8A8A7A' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E8E6DF', fontSize: 11 }} formatter={v => v != null ? v+'%' : '—'} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {CONS_NAMES.map((n, i) => (
                  <Line key={n} type="monotone" dataKey={n} stroke={CONS_COLORS[i]} strokeWidth={2} dot={{ r: 3 }} connectNulls name={n.split(' ')[0]} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ ...S.card, marginTop: 14 }}>
            <div style={S.h3}>CV cumulatif Conv. Tél. — par conseillere</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {CONS_NAMES.map((n, i) => (
                <div key={n} style={{ background: '#F8F7F4', borderRadius: 8, padding: '10px 14px', borderLeft: `3px solid ${CONS_COLORS[i]}` }}>
                  <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 4 }}>{n.split(' ')[0]}</div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                    <div><div style={{ fontSize: 10, color: '#8A8A7A' }}>Conv. Tél. Avr</div><div style={{ fontWeight: 700, color: CONS_COLORS[i], fontSize: 15 }}>{CONV_TEL_MM[n]?.conv_tel[3] ?? '—'}%</div></div>
                    <div><div style={{ fontSize: 10, color: '#8A8A7A' }}>CV cumulatif</div><CvBadge cv={CONV_TEL_MM[n]?.cv_cumul[3]} small /></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {subTab === 'jj' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
            {CONS_NAMES.map((n, i) => (
              <button key={n} onClick={() => setSelCons(n)} style={{
                padding: '4px 12px', borderRadius: 16, border: `1px solid ${selCons===n ? CONS_COLORS[i] : '#E8E6DF'}`,
                background: selCons===n ? CONS_COLORS[i]+'18' : '#fff',
                color: selCons===n ? CONS_COLORS[i] : '#5A5A5A', fontSize: 11, cursor: 'pointer', fontWeight: selCons===n ? 500 : 400,
              }}>{n.split(' ')[0]}</button>
            ))}
          </div>
          <div style={S.card}>
            <div style={S.h3}>{selCons.split(' ')[0]} — Conv. Tél. journalier + CV cumulatif</div>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={dataJJ}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: '#5A5A5A' }} axisLine={false} tickLine={false} interval={2} />
                <YAxis yAxisId="ct" tick={{ fontSize: 11, fill: '#8A8A7A' }} axisLine={false} tickLine={false} unit="%" />
                <YAxis yAxisId="cv" orientation="right" tick={{ fontSize: 11, fill: '#534AB7' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E8E6DF', fontSize: 11 }} formatter={v => v != null ? v+'%' : '—'} />
                <Bar yAxisId="ct" dataKey="ct" name="Conv. Tel. jour" fill="#C9A84C" radius={[3,3,0,0]} opacity={0.7} />
                <Line yAxisId="cv" type="monotone" dataKey="cv" name="CV cumulatif" stroke="#534AB7" strokeWidth={2} dot={false} connectNulls />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section Segmentation (+ Régularité) ────────────────────────────────────
const SEGMENTATION = {
  sale: {
    seuils: 'Tier 1 >= 12% · Tier 2 5-11.9% · Tier 3 < 5%',
    tiers: [
      { tier: 1, nom: 'Khalid Amghoud', tv: 17, delai: '1j' },
      { tier: 1, nom: 'Najlaa Maarouf', tv: 14.3, delai: '2j' },
      { tier: 2, nom: 'Saad Fellah', tv: 8.7, delai: '5j' },
      { tier: 2, nom: 'Nouhaila Belhadj', tv: 8, delai: '1j' },
      { tier: 2, nom: 'Abdelhak L.', tv: 6.2, delai: '2.5j' },
      { tier: 3, nom: 'Yasmina Souaq', tv: 1.4, delai: '5j' },
    ]
  },
  kenitra: {
    seuils: 'Tier 1 >= 15% · Tier 2 5-14.9% · Tier 3 < 5%',
    tiers: [
      { tier: 1, nom: 'Samia Ahalay', tv: 36.4, delai: '10j', warn: true },
      { tier: 1, nom: 'Nissrine Irfden', tv: 22.2, delai: '11.5j', warn: true },
      { tier: 1, nom: 'Ismail Hammouch', tv: 16.7, delai: '2j' },
      { tier: 2, nom: 'Alae Elmoussaid', tv: 5.9, delai: '2j' },
      { tier: 3, nom: 'Meryem E.', tv: 2.7, delai: '1j' },
      { tier: 3, nom: 'Autres (10)', tv: 0, delai: '-' },
    ]
  }
}
const CV_REG = [
  { nom: 'Khalid', tv: 33.3, cv: 167.9, tier: 'r' },
  { nom: 'Nouhaila', tv: 14.8, cv: 189.5, tier: 'r' },
  { nom: 'Saad', tv: 8.3, cv: 220.6, tier: 'v' },
  { nom: 'Abdelhak', tv: 5.8, cv: 222.3, tier: 'v' },
  { nom: 'Samia (K)', tv: 33.3, cv: 249.4, tier: 'v' },
  { nom: 'Najlaa', tv: 14.3, cv: 320.2, tier: 'tv' },
  { nom: 'Meryem (K)', tv: 6.7, cv: 458.3, tier: 'tv' },
  { nom: 'Ismail (K)', tv: 11.1, cv: 469, tier: 'tv' },
]

function SectionSegmentation() {
  const [subTab, setSubTab] = useState('tiers')
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <SubTab label="Tiers 1/2/3" active={subTab==='tiers'} onClick={() => setSubTab('tiers')} />
        <SubTab label="Regularite (CV JJ)" active={subTab==='reg'} onClick={() => setSubTab('reg')} />
      </div>
      {subTab === 'tiers' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
          {[{key:'sale',label:'Equipe Sale',color:'#C9A84C'},{key:'kenitra',label:'Equipe Kenitra',color:'#534AB7'}].map(eq => (
            <div key={eq.key} style={{ ...S.card, borderTop: `3px solid ${eq.color}` }}>
              <div style={{ fontWeight: 600, color: eq.color, marginBottom: 4 }}>{eq.label}</div>
              <div style={{ fontSize: 11, color: '#8A8A7A', marginBottom: 12 }}>{SEGMENTATION[eq.key].seuils}</div>
              {SEGMENTATION[eq.key].tiers.map((t, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid #F0EEE9' }}>
                  <TierBadge tier={t.tier} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{t.nom} {t.warn && <span style={{ color: '#E8A040', fontSize: 10 }}>delai!</span>}</div>
                    <div style={{ fontSize: 10, color: '#8A8A7A' }}>Med. {t.delai}</div>
                  </div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: t.tier===1?'#4CAF7D':t.tier===2?'#C9A84C':'#E05C5C' }}>{t.tv}%</div>
                  <div style={{ width: 60, height: 5, background: '#F0EEE9', borderRadius: 3 }}>
                    <div style={{ width: Math.min(100,(t.tv/40)*100)+'%', height:'100%', background: t.tier===1?'#4CAF7D':t.tier===2?'#C9A84C':'#E05C5C', borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
      {subTab === 'reg' && (
        <div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
            {[{l:'<= 200%',label:'Regulier',color:'#4CAF7D',bg:'#E6F7EF'},{l:'200-300%',label:'Variable',color:'#E8A040',bg:'#FDF6E3'},{l:'> 300%',label:'Tres variable',color:'#E05C5C',bg:'#FEF0F0'}].map(t => (
              <div key={t.l} style={{ background: t.bg, border: `1px solid ${t.color}33`, borderRadius: 10, padding: '10px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: t.color }}>{t.l}</div>
                <div style={{ fontSize: 11, color: t.color }}>{t.label}</div>
              </div>
            ))}
          </div>
          <div style={S.card}>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={CV_REG}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" vertical={false} />
                <XAxis dataKey="nom" tick={{ fontSize: 11, fill: '#5A5A5A' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8A8A7A' }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E8E6DF', fontSize: 11 }} formatter={v => v+'%'} />
                <ReferenceLine y={200} stroke="#E8A040" strokeDasharray="4 2" />
                <ReferenceLine y={300} stroke="#E05C5C" strokeDasharray="4 2" />
                <Bar dataKey="cv" name="CV%" radius={[4,4,0,0]}>
                  {CV_REG.map((c, i) => <Cell key={i} fill={c.tier==='r'?'#4CAF7D':c.tier==='v'?'#E8A040':'#E05C5C'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            <table style={{ width:'100%', borderCollapse:'collapse', marginTop: 12 }}>
              <thead><tr>{['Commercial','TV%','CV%','Profil'].map(h=><th key={h} style={{...S.th,textAlign:h==='Commercial'?'left':'center'}}>{h}</th>)}</tr></thead>
              <tbody>
                {CV_REG.map(c => (
                  <tr key={c.nom}>
                    <td style={{...S.td,fontWeight:500}}>{c.nom}</td>
                    <td style={{...S.td,textAlign:'center',fontWeight:600,color:c.tv>=15?'#4CAF7D':'#C9A84C'}}>{c.tv}%</td>
                    <td style={{...S.td,textAlign:'center'}}><CvBadge cv={c.cv}/></td>
                    <td style={{...S.td,textAlign:'center',fontSize:11,color:c.tier==='r'?'#4CAF7D':c.tier==='v'?'#E8A040':'#E05C5C'}}>
                      {c.tier==='r'?'Regulier':c.tier==='v'?'Variable':'Tres variable'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section Cohorte ────────────────────────────────────────────────────────
const COHORTE = [
  { nom: 'Khalid', tv: 17, vtes: 8, moy: 10.1, med: 1, j3: 5, j14: 3 },
  { nom: 'Najlaa', tv: 14.3, vtes: 2, moy: 2, med: 2, j3: 2, j14: 0 },
  { nom: 'Nouhaila', tv: 8, vtes: 8, moy: 1.5, med: 1, j3: 7, j14: 0 },
  { nom: 'Saad', tv: 8.7, vtes: 9, moy: 3.8, med: 5, j3: 4, j14: 0 },
  { nom: 'Abdelhak', tv: 6.2, vtes: 4, moy: 2, med: 2.5, j3: 4, j14: 0 },
  { nom: 'Samia (K)', tv: 36.4, vtes: 4, moy: 10, med: 10, j3: 1, j14: 1 },
  { nom: 'Nissrine (K)', tv: 22.2, vtes: 2, moy: 11.5, med: 11.5, j3: 1, j14: 1 },
  { nom: 'Ismail (K)', tv: 16.7, vtes: 3, moy: 2.7, med: 2, j3: 2, j14: 0 },
  { nom: 'Alae (K)', tv: 5.9, vtes: 2, moy: 2, med: 2, j3: 2, j14: 0 },
]

function SectionCohorte() {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {[{l:'Ventes analysees',v:'44'},{l:'Delai moyen global',v:'5.0j'},{l:'Mediane globale',v:'2j'},{l:'Ventes <= 3j',v:'72.7%'}].map(k=>(
          <div key={k.l} style={S.kpiCard}><div style={{...S.kpiVal,fontSize:20}}>{k.v}</div><div style={S.kpiLabel}>{k.l}</div></div>
        ))}
      </div>
      <div style={S.card}>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead><tr>{['Commercial','TV%','Ventes','Moy.','Med.','<=3j','>14j'].map(h=><th key={h} style={{...S.th,textAlign:h==='Commercial'?'left':'center'}}>{h}</th>)}</tr></thead>
          <tbody>
            {COHORTE.map(c=>(
              <tr key={c.nom}>
                <td style={{...S.td,fontWeight:500}}>{c.nom}</td>
                <td style={{...S.td,textAlign:'center',fontWeight:600,color:c.tv>=15?'#4CAF7D':'#C9A84C'}}>{c.tv}%</td>
                <td style={{...S.td,textAlign:'center'}}>{c.vtes}</td>
                <td style={{...S.td,textAlign:'center',color:c.moy>7?'#E05C5C':'#2C2C2C'}}>{c.moy}j</td>
                <td style={{...S.td,textAlign:'center',fontWeight:600}}>{c.med}j</td>
                <td style={{...S.td,textAlign:'center',color:'#4CAF7D',fontWeight:500}}>{c.j3}</td>
                <td style={{...S.td,textAlign:'center',color:c.j14>0?'#E05C5C':'#8A8A7A'}}>{c.j14}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{...S.card,marginTop:12,background:'#FEF8ED',borderLeft:'3px solid #E8A040',fontSize:12,color:'#5A5A5A'}}>
        Flux entrant (CC) : 27% des ventes analysees — delai moyen 2.2j vs 6.0j flux sortant
      </div>
    </div>
  )
}

// ── Section Synthèse ──────────────────────────────────────────────────────
const MESSAGES = [
  { color:'#4CAF7D', titre:'Avril : meilleur mois', texte:'31 ventes operationnelles · TV% 9.0% · +108% vs Fev' },
  { color:'#C9A84C', titre:'Sale domine', texte:'27/31 ventes · TV% 10.9% vs 4.3% Kenitra · Khalid #1 (33.3%)' },
  { color:'#E05C5C', titre:'Funnel : tension amont', texte:'Indispos avril +132% vs mars · Base nette +22% · Volume injections en hausse' },
  { color:'#534AB7', titre:'Delais courts = meilleures ventes', texte:'72.7% des ventes realisees en <=3j · Mediane globale = 2j' },
  { color:'#E8A040', titre:'Kenitra : potentiel a activer', texte:'Samia 36.4% TV% · Nissrine 22.2% · mais delais >10j a corriger' },
  { color:'#8A8A7A', titre:'Regularite a ameliorer', texte:'CV JJ > 300% pour Najlaa, Ismail, Meryem · pics isoles, pas de rythme stable' },
]

function SectionSynthese() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 14 }}>
      {MESSAGES.map((m, i) => (
        <div key={i} style={{ ...S.card, borderLeft: `4px solid ${m.color}`, display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: m.color+'18', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontWeight: 700, color: m.color, fontSize: 13 }}>{i+1}</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 3 }}>{m.titre}</div>
            <div style={{ fontSize: 11, color: '#5A5A5A', lineHeight: 1.6 }}>{m.texte}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
const SLIDES = [
  { id: 'marketing', label: 'Marketing' },
  { id: 'flux', label: 'Flux RDV' },
  { id: 'perf', label: 'Perf. Commerciale' },
  { id: 'conseilleres', label: 'Eff. Conseilleres' },
  { id: 'segmentation', label: 'Segmentation' },
  { id: 'cohorte', label: 'Cohorte Delais' },
  { id: 'synthese', label: 'Synthese' },
]

export default function EtudeCommerciale2026() {
  const navigate = useNavigate()
  const [active, setActive] = useState('marketing')

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <button onClick={() => navigate('/etudes')} style={{ background: 'none', border: 'none', color: '#8A8A7A', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 6 }}>
            &larr; Retour aux etudes
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#2C2C2C', margin: 0 }}>Etude Commerciale 2026</h1>
          <div style={{ fontSize: 12, color: '#8A8A7A', marginTop: 3 }}>Janvier - Avril 2026 · Sale + Kenitra · Lecture seule</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[{v:31,l:'Ventes Avr'},{v:'4',l:'Mois'},{v:'2',l:'Equipes'}].map(k=>(
            <div key={k.l} style={S.kpiCard}><div style={S.kpiVal}>{k.v}</div><div style={S.kpiLabel}>{k.l}</div></div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' }}>
        {SLIDES.map(s => (
          <button key={s.id} onClick={() => setActive(s.id)} style={{
            padding: '7px 16px', borderRadius: 20,
            border: `1px solid ${active===s.id ? '#C9A84C' : '#E8E6DF'}`,
            background: active===s.id ? '#C9A84C' : '#fff',
            color: active===s.id ? '#fff' : '#5A5A5A',
            fontSize: 12, fontWeight: active===s.id ? 500 : 400, cursor: 'pointer',
          }}>{s.label}</button>
        ))}
      </div>

      {active === 'marketing' && <SectionMarketing />}
      {active === 'flux' && <SectionFluxRDV />}
      {active === 'perf' && <SectionPerfComm />}
      {active === 'conseilleres' && <SectionEffConseillere />}
      {active === 'segmentation' && <SectionSegmentation />}
      {active === 'cohorte' && <SectionCohorte />}
      {active === 'synthese' && <SectionSynthese />}
    </div>
  )
}