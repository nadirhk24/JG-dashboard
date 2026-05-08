import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import EtudeSourcePicker from '../components/EtudeSourcePicker'
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
    ventes:  [0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 1.0, 1.0, null],
    tv:      [0.0, 0.0, 0.0, 50.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 33.3, 50.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 50.0, 0.0, 33.3, 50.0, null],
    cv_cumul:[null, null, null, 200.0, 223.6, 244.9, 264.6, 282.8, 300.0, 316.2, 331.7, 346.4, 244.1, 198.7, 207.0, 215.0, 222.7, 230.1, 237.3, 244.2, 251.0, 217.1, 222.8, 199.1, 181.6, 181.6],
  },
  'Najlaa Maarouf': {
    equipe: 'Sale',
    rdv:     [null, null, null, 0.0, 0.0, null, 0.0, 1.0, null, null, 5.0, 1.0, 2.0, 2.0, 6.0, 2.0, 6.0, 8.0, 4.0, 6.0, 8.0, 3.0, 3.0, 8.0, null, null],
    visites: [null, null, null, 1.0, 2.0, null, 1.0, 1.0, null, null, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 2.0, 0.0, 3.0, 0.0, 1.0, 2.0, 0.0, 0.0, null, null],
    ventes:  [null, null, null, 0.0, 0.0, null, 0.0, 0.0, null, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, null],
    tv:      [null, null, null, 0.0, 0.0, null, 0.0, 0.0, null, null, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 25.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, null],
    cv_cumul:[null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 360.6, 374.2, 387.3, 400.0, 412.3, 424.3, 424.3, 424.3],
  },
  'Nouhaila Belhadj': {
    equipe: 'Sale',
    rdv:     [2.0, 8.0, 10.0, 0.0, 10.0, 13.0, 20.0, 22.0, 13.0, 9.0, 14.0, 10.0, 4.0, 1.0, 5.0, 2.0, 1.0, 3.0, 16.0, 11.0, 8.0, 4.0, 16.0, 10.0, null, 0.0],
    visites: [1.0, 1.0, 1.0, 2.0, 3.0, 3.0, 0.0, 5.0, 2.0, 4.0, 3.0, 2.0, 3.0, 2.0, 0.0, 0.0, 3.0, 2.0, 0.0, 2.0, 0.0, 3.0, 6.0, 4.0, null, 2.0],
    ventes:  [0.0, 0.0, 0.0, 1.0, 0.0, 2.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 2.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, 0.0],
    tv:      [0.0, 0.0, 0.0, 33.3, 0.0, 40.0, 0.0, 0.0, 0.0, 20.0, 0.0, 0.0, 25.0, 0.0, 0.0, 0.0, 40.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, null, 0.0],
    cv_cumul:[null, null, null, 200.0, 223.6, 167.3, 183.6, 198.4, 212.1, 174.8, 185.4, 195.4, 169.1, 177.3, 185.2, 192.7, 173.0, 179.4, 185.7, 191.7, 197.5, 203.1, 208.6, 214.0, 214.0, 219.2],
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
  'Khalid Amghoud': { equipe: 'Sale', tv: [25.9, 0, 2.8, 22.2], cv_cumul: [null, null, 80.5, 62.9] },
  'Najlaa Maarouf': { equipe: 'Sale', tv: [null, null, null, 6.7], cv_cumul: [null, null, null, null] },
  'Nouhaila Belhadj': { equipe: 'Sale', tv: [0, 0, 0, 11.5], cv_cumul: [null, null, null, null] },
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
  'Fatima Zahraa AAKIBA': { short: 'Fatima', conv_tel: [31.7, 23.7, 27.0, 29.1], cv_cumul: [null, 14.4, 12.0, 11.8] },
  'Ghizlane ELBAKARI': { short: 'Ghizlane', conv_tel: [25.5, 19.2, 28.1, 46.1], cv_cumul: [null, 14.1, 15.4, 28.3] },
  'Hala ELAOUAD': { short: 'Hala', conv_tel: [21.4, 16.2, 21.8, 30.0], cv_cumul: [null, 13.8, 12.9, 36.3] },
  'Kaoutar HRARTI': { short: 'Kaoutar', conv_tel: [null, 19.4, 20.2, 42.2], cv_cumul: [null, null, 2.0, 51.5] },
  'Rajaa ELKHANCHAR': { short: 'Rajaa', conv_tel: [57.0, 24.1, 21.1, 50.1], cv_cumul: [null, 40.6, 47.7, 56.6] },
  'Siham IBNTABET': { short: 'Siham', conv_tel: [33.5, 0.0, 21.0, 14.7], cv_cumul: [null, null, 22.9, 39.6] },
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

// ── CV glissant 5j (non cumulatif, zeros inclus) ──
const CV_ROLLING_JJ = {
  'Alae Elmoussaid': [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  'Asmaa Radouli': [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  'Hajar Snaiki': [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  'Hicham Mechach': [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  'Ismail Hammouch': [null, null, null, null, 200.0, 200.0, 200.0, 200.0, 200.0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  'Marouane Cachchi': [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  'Meryem Elbouchikhi': [null, null, null, null, 200.0, 200.0, 200.0, 200.0, 200.0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  'Nawfal Jdia': [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  'Nissrine Irfden': [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  'Oumaima Belbacha': [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  'Rim Snaiki': [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  'Salima Fikri': [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  'Samia Ahalay': [null, null, null, null, 141.4, 141.4, 141.4, 173.2, 173.2, 173.2, 200.0, 200.0, 200.0, 200.0, 200.0, 200.0, 200.0, null, null, null, 200.0, 200.0, 200.0, 200.0, 200.0, 200.0],
  'Souad Acoine': [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  'Youssef Saadouni': [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
  'Abdelhak Lakouissmi': [null, null, null, null, null, null, null, null, null, 173.2, 200.0, 122.5, 122.5, 122.5, 200.0, 200.0, null, null, null, null, null, null, null, null, 200.0, 128.7],
  'Khalid Amghoud': [null, null, null, 200.0, 223.6, 244.9, 264.6, 282.8, 300.0, 316.2, 331.7, 346.4, 244.1, 198.7, 207.0, 215.0, 222.7, 230.1, 237.3, 244.2, 251.0, 217.1, 222.8, 199.1, 181.6, 181.6],
  'Najlaa Maarouf': [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 360.6, 374.2, 387.3, 400.0, 412.3, 424.3, 424.3, 424.3],
  'Nouhaila Belhadj': [null, null, null, 200.0, 223.6, 167.3, 183.6, 198.4, 212.1, 174.8, 185.4, 195.4, 169.1, 177.3, 185.2, 192.7, 173.0, 179.4, 185.7, 191.7, 197.5, 203.1, 208.6, 214.0, 214.0, 219.2],
  'Saad Fellah': [null, null, null, 173.2, 128.7, 128.7, 128.7, 128.7, 200.0, null, 200.0, 200.0, 144.2, 144.2, 144.2, 200.0, 200.0, null, null, null, null, 200.0, 200.0, 200.0, 200.0, 200.0],
  'Yasmina Souaq': [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
}

const CV_ROLLING_CONS_JJ = {
  'Fatima Zahraa AAKIBA': [null, 17.1, 17.1, 22.5, 29.9, 56.5, 58.1, 49.5, 45.8, 39.3, 46.1, 46.1, 60.7, 68.8, 41.1, 41.3, 45.7, 48.2, 34.8, 34.8, 36.8, 34.4, 32.4, 27.8, 10.3],
  'Ghizlane ELBAKARI': [null, 20.2, 17.0, 17.5, 16.7, 20.6, 22.0, 33.3, 43.6, 41.9, 43.7, 35.1, 65.9, 63.0, 57.9, 56.7, 72.3, 46.3, 46.3, 45.0, 51.9, 35.6, 36.2, 31.0, 14.7],
  'Hala ELAOUAD': [null, 23.1, 49.6, 59.7, 52.7, 52.7, 41.6, 75.7, 55.9, 64.2, 74.8, 79.1, 50.4, 54.9, 64.4, 58.8, 95.6, 98.1, 85.1, 68.6, 70.6, 44.4, 44.6, 46.5, 29.3],
  'Kaoutar HRARTI': [null, 4.2, 14.7, 26.3, 24.3, 33.0, 32.7, 26.9, 27.8, 23.6, 14.6, 69.2, 65.1, 71.2, 67.1, 75.9, 96.9, 50.3, 43.7, 31.4, 27.8, 21.0, 27.9, 30.4, 28.0],
  'Rajaa ELKHANCHAR': [null, 8.6, 7.4, 8.7, 13.9, 31.2, 31.1, 30.4, 37.1, 34.0, 35.3, 63.3, 69.0, 76.6, 101.6, 81.0, 73.3, 73.1, 66.4, 36.8, 34.1, 17.3, 23.2, 28.9, 29.4],
  'Siham IBNTABET': [null, 85.4, 110.6, 130.8, 149.7, 156.7, 60.4, 42.3, 143.3, 116.2, 100.7, 75.1, 86.1, 71.8, 73.6, 80.0, 79.8, 53.1, 54.0, 39.8, 39.7, 32.3, 38.9, 29.7, 22.0],
}

// ── CV global mensuel (ecart-type/moyenne sur 4 mois, = formule regularite) ──
const CV_GLOBAL_MM = {
  'Abdelhak Lakouissmi': { equipe: 'Sale', tv: [null, null, null, 5.8], cv_mois: [null, null, null, null] },
  'Khalid Amghoud': { equipe: 'Sale', tv: [25.9, 0, 2.8, 22.2], cv_mois: [null, 100.0, 121.3, 92.7] },
  'Najlaa Maarouf': { equipe: 'Sale', tv: [null, null, null, 6.7], cv_mois: [null, null, null, null] },
  'Nouhaila Belhadj': { equipe: 'Sale', tv: [0, 0, 0, 11.5], cv_mois: [null, null, null, 173.2] },
  'Saad Fellah': { equipe: 'Sale', tv: [22.2, 7.1, 5.3, 8.3], cv_mois: [null, 51.5, 65.7, 62.6] },
  'Yasmina Souaq': { equipe: 'Sale', tv: [7.4, 0, 3.2, 0], cv_mois: [null, 100.0, 85.8, 114.6] },
  'Alae Elmoussaid': { equipe: 'Kenitra', tv: [0, 0, 15.4, 0], cv_mois: [null, null, 141.4, 173.2] },
  'Ismail Hammouch': { equipe: 'Kenitra', tv: [9.1, 40, 11.1, 11.1], cv_mois: [null, 62.9, 70.4, 72.0] },
  'Meryem Elbouchikhi': { equipe: 'Kenitra', tv: [0, 0, 0, 6.7], cv_mois: [null, null, null, 173.2] },
  'Samia Ahalay': { equipe: 'Kenitra', tv: [0, 100, 20, 33.3], cv_mois: [null, 100.0, 108.0, 97.9] },
  'Nawfal Jdia': { equipe: 'Kenitra', tv: [66.7, 0, 0, 0], cv_mois: [null, 100.0, 141.4, 173.2] },
  'Nissrine Irfden': { equipe: 'Kenitra', tv: [14.3, 33.3, 33.3, 0], cv_mois: [null, 39.9, 33.2, 69.3] },
  'Oumaima Belbacha': { equipe: 'Kenitra', tv: [0, 0, 0, 0], cv_mois: [null, null, null, null] },
}


// ── CV global (ecart-type/moyenne sur tous les points) ──
const CV_GLOBAL_JJ_COMMS = {
  'Yasmina Souaq': null,
  'Nouhaila Belhadj': 219.2,
  'Abdelhak Lakouissmi': 222.3,
  'Saad Fellah': 220.6,
  'Khalid Amghoud': 181.6,
  'Najlaa Maarouf': 424.3,
  'Ismail Hammouch': 469.0,
  'Alae Elmoussaid': null,
  'Marouane Cachchi': null,
  'Nissrine Irfden': null,
  'Souad Acoine': null,
  'Rim Snaiki': null,
  'Asmaa Radouli': null,
  'Youssef Saadouni': null,
  'Nawfal Jdia': null,
  'Samia Ahalay': 249.4,
  'Hicham Mechach': null,
  'Oumaima Belbacha': null,
  'Hajar Snaiki': null,
  'Meryem Elbouchikhi': 458.3,
  'Salima Fikri': null,
}

const CONV_TEL_GLOBAL_AVR = {
  'Fatima Zahraa AAKIBA': 29.1,
  'Ghizlane ELBAKARI': 46.1,
  'Hala ELAOUAD': 30.0,
  'Kaoutar HRARTI': 42.2,
  'Rajaa ELKHANCHAR': 50.1,
  'Siham IBNTABET': 14.7,
}

const CV_GLOBAL_JJ_CONS = {
  'Fatima Zahraa AAKIBA': 56.8,
  'Ghizlane ELBAKARI': 58.1,
  'Hala ELAOUAD': 84.4,
  'Kaoutar HRARTI': 74.0,
  'Rajaa ELKHANCHAR': 70.6,
  'Siham IBNTABET': 153.6,
}

const CV_GLOBAL_MM_CONS = {
  'Fatima Zahraa AAKIBA': 11.8,
  'Ghizlane ELBAKARI': 28.3,
  'Hala ELAOUAD': 36.3,
  'Kaoutar HRARTI': 51.5,
  'Rajaa ELKHANCHAR': 56.6,
  'Siham IBNTABET': 73.6,
}

const CV_GLOBAL_MM_COMMS = {
  'Abdelhak Lakouissmi': null,
  'Khalid Amghoud': 92.7,
  'Najlaa Maarouf': null,
  'Nouhaila Belhadj': 173.2,
  'Saad Fellah': 62.6,
  'Yasmina Souaq': 114.6,
  'Alae Elmoussaid': 173.2,
  'Ismail Hammouch': 72.0,
  'Meryem Elbouchikhi': 173.2,
  'Samia Ahalay': 97.9,
  'Nawfal Jdia': 173.2,
  'Nissrine Irfden': 69.3,
  'Oumaima Belbacha': null,
}

const TV_GLOBAL_AVR_COMMS = {
  'Alae Elmoussaid': 0.0, 'Asmaa Radouli': 0.0, 'Hajar Snaiki': 0.0,
  'Hicham Mechach': null, 'Ismail Hammouch': 11.1, 'Marouane Cachchi': 0.0,
  'Meryem Elbouchikhi': 6.7, 'Nawfal Jdia': 0.0, 'Nissrine Irfden': 0.0,
  'Oumaima Belbacha': 0.0, 'Rim Snaiki': 0.0, 'Salima Fikri': 0.0,
  'Samia Ahalay': 33.3, 'Souad Acoine': 0.0, 'Youssef Saadouni': 0.0,
  'Abdelhak Lakouissmi': 5.8, 'Khalid Amghoud': 22.2, 'Najlaa Maarouf': 6.7,
  'Nouhaila Belhadj': 11.5, 'Saad Fellah': 8.3, 'Yasmina Souaq': 0.0,
}

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
  const [visibleComms, setVisibleComms] = useState(() => Object.fromEntries([...SALE_NAMES,...KEN_NAMES].map(n => [n, true])))
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
      <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
        {names.map((n, i) => (
          <button key={n} onClick={() => setVisibleComms(p => ({ ...p, [n]: !p[n] }))} style={{
            padding: '3px 10px', borderRadius: 16,
            border: `1px solid ${visibleComms[n] !== false ? colors[i%colors.length] : '#E8E6DF'}`,
            background: visibleComms[n] !== false ? colors[i%colors.length]+'18' : '#fff',
            color: visibleComms[n] !== false ? colors[i%colors.length] : '#8A8A7A',
            fontSize: 11, cursor: 'pointer',
          }}>{n.split(' ')[0]}</button>
        ))}
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
            {names.map((n, i) => visibleComms[n] !== false && (
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
function SectionPerfComm({ openPicker, liveData }) {
  const [subTab, setSubTab] = useState('mm')
  const [equipe, setEquipe] = useState('Sale')
  const [selComm, setSelComm] = useState('Saad Fellah')
  const [visiblePerfComms, setVisiblePerfComms] = useState(() => Object.fromEntries([...SALE_NAMES,...KEN_NAMES].map(n => [n, true])))
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
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {names.map((n, i) => (
              <button key={n} onClick={() => setVisiblePerfComms(p => ({ ...p, [n]: !p[n] }))} style={{
                padding: '3px 10px', borderRadius: 16,
                border: `1px solid ${visiblePerfComms[n] !== false ? colors[i%colors.length] : '#E8E6DF'}`,
                background: visiblePerfComms[n] !== false ? colors[i%colors.length]+'18' : '#fff',
                color: visiblePerfComms[n] !== false ? colors[i%colors.length] : '#8A8A7A',
                fontSize: 11, cursor: 'pointer',
              }}>{n.split(' ')[0]}</button>
            ))}
          </div>
          <div style={S.card}>
            <div style={S.h3}>Taux de conversion 2026 — par commercial</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dataMM}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 12, fill: '#5A5A5A' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8A8A7A' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E8E6DF', fontSize: 11 }} formatter={v => v != null ? v+'%' : '—'} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {names.map((n, i) => visiblePerfComms[n] !== false && (
                  <Line key={n} type="monotone" dataKey={n+'_tv'} stroke={colors[i % colors.length]} strokeWidth={1.5} dot={{ r: 3 }} connectNulls name={n.split(' ')[0]} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ ...S.card, marginTop: 14 }}>
            <div style={S.h3}>CV Taux de conversion 2026 — par commercial</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
              {names.filter(n => COMMS_MM[n]).map((n, i) => {
                const tvArr = COMMS_MM[n].tv.filter(v => v != null)
                return (
                  <div key={n}
                    onClick={() => openPicker?.(`TV% ${n}`, (src, data) => {})}
                    style={{ background: '#F8F7F4', borderRadius: 8, padding: '10px 14px', borderLeft: `3px solid ${colors[i % colors.length]}`, cursor: 'pointer' }}
                    title="Cliquer pour lier à une source Supabase"
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ fontSize: 12, fontWeight: 500 }}>{n}</div>
                      <span style={{ fontSize: 10, color: '#C9A84C' }}>⟳ source</span>
                    </div>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                      <div>
                        <div style={{ fontSize: 10, color: '#8A8A7A' }}>TV% Avr</div>
                        <div style={{ fontWeight: 700, color: colors[i%colors.length], fontSize: 16 }}>
                          {(() => {
                            const live = liveData?.['flux_tv_mensuel']?.[n]?.vals
                            const vals = live || COMMS_MM[n]?.tv
                            if (!vals) return '—%'
                            const nonNull = vals.filter(v => v != null)
                            const moy = nonNull.length > 0 ? parseFloat((nonNull.reduce((a,b)=>a+b,0)/nonNull.length).toFixed(1)) : null
                            return moy != null ? `${moy}%` : '—%'
                          })()}
                        </div>
                        <div style={{ fontSize: 9, color: '#8A8A7A' }}>Moy. 2026</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#8A8A7A' }}>CV mensuel</div>
                        <CvBadge cv={CV_GLOBAL_MM_COMMS[n]} small />
                      </div>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={S.h3}>{selComm} — Taux de conversion Avril</div>
              <div
                onClick={() => openPicker?.(`TV% JJ ${selComm}`, (src, data) => {})}
                style={{ background: '#F8F7F4', borderRadius: 8, padding: '8px 14px', textAlign: 'center', cursor: 'pointer' }}
                title="Cliquer pour lier à une source Supabase"
              >
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', marginBottom: 2 }}>
                  <div style={{ fontSize: 10, color: '#8A8A7A' }}>TV% Avr</div>
                  <span style={{ fontSize: 10, color: '#C9A84C' }}>⟳</span>
                </div>
                <div style={{ fontWeight: 700, fontSize: 16, color: '#C9A84C' }}>
                  {TV_GLOBAL_AVR_COMMS[selComm] != null ? `${TV_GLOBAL_AVR_COMMS[selComm]}%` : '—'}
                </div>
                <div style={{ fontSize: 10, color: '#8A8A7A', marginTop: 2 }}>CV: <CvBadge cv={CV_GLOBAL_JJ_COMMS[selComm]} small /></div>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={dataJJ}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: '#5A5A5A' }} axisLine={false} tickLine={false} interval={3} />
                <YAxis tick={{ fontSize: 11, fill: '#8A8A7A' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E8E6DF', fontSize: 11 }} formatter={v => v != null ? v+'%' : '—'} />
                <Bar dataKey="tv" name="TV% jour" fill="#C9A84C" radius={[3,3,0,0]} opacity={0.7} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Cartes TV% global par commercial */}
          <div style={{ ...S.card, marginTop: 14 }}>
            <div style={S.h3}>TV% Avr — tous les commerciaux ({equipe === 'Sale' ? 'Equipe Sale' : 'Equipe Kenitra'})</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 10, marginTop: 10 }}>
              {names.map((n, i) => (
                <div key={n}
                  onClick={() => setSelComm(n)}
                  style={{
                    background: selComm === n ? colors[i%colors.length]+'18' : '#F8F7F4',
                    borderRadius: 8, padding: '10px 14px',
                    border: selComm === n ? `1.5px solid ${colors[i%colors.length]}` : `1px solid #E8E6DF`,
                    borderLeft: `3px solid ${colors[i%colors.length]}`,
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 500, color: '#2C2C2C', marginBottom: 6 }}>{n.split(' ')[0]}</div>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#8A8A7A' }}>TV% Avr</div>
                      <div style={{ fontWeight: 700, fontSize: 18, color: (TV_GLOBAL_AVR_COMMS[n] ?? 0) > 10 ? '#4CAF7D' : (TV_GLOBAL_AVR_COMMS[n] ?? 0) > 0 ? '#C9A84C' : '#E05C5C' }}>
                        {TV_GLOBAL_AVR_COMMS[n] != null ? `${TV_GLOBAL_AVR_COMMS[n]}%` : '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#8A8A7A' }}>CV JJ</div>
                      <CvBadge cv={CV_GLOBAL_JJ_COMMS[n]} small />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Section Efficacité Conseillères ────────────────────────────────────────
function SectionEffConseillere({ openPicker, liveData }) {
  const [subTab, setSubTab] = useState('mm')
  const [selCons, setSelCons] = useState('Fatima Zahraa AAKIBA')
  const [visibleCons, setVisibleCons] = useState(() => Object.fromEntries(CONS_NAMES.map(n => [n, true])))

  const dataMM = MOIS_LABELS.map((m, mi) => {
    const row = { mois: m }
    CONS_NAMES.forEach(n => {
      // Priorité aux données live si disponibles
      const live = liveData?.['cc_conv_tel_mensuel']?.[n]?.[mi]
      const v = live != null ? live : (CONV_TEL_MM[n]?.conv_tel[mi] ?? null)
      row[n] = v !== null ? Math.min(100, v) : null
    })
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
    cv: CV_ROLLING_CONS_JJ[selCons]?.[di] ?? null,
  }))

  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        <SubTab label="Mensuel 2026" active={subTab==='mm'} onClick={() => setSubTab('mm')} />
        <SubTab label="Jour par jour — Avril" active={subTab==='jj'} onClick={() => setSubTab('jj')} />
      </div>

      {subTab === 'mm' && (
        <div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
            {CONS_NAMES.map((n, i) => (
              <button key={n} onClick={() => setVisibleCons(p => ({ ...p, [n]: !p[n] }))} style={{
                padding: '3px 10px', borderRadius: 16,
                border: `1px solid ${visibleCons[n] ? CONS_COLORS[i] : '#E8E6DF'}`,
                background: visibleCons[n] ? CONS_COLORS[i]+'18' : '#fff',
                color: visibleCons[n] ? CONS_COLORS[i] : '#8A8A7A',
                fontSize: 11, cursor: 'pointer',
              }}>{n.split(' ')[0]}</button>
            ))}
          </div>
          <div style={S.card}>
            <div style={S.h3}>Taux de conversion 2026 — par conseillere</div>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dataMM}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" vertical={false} />
                <XAxis dataKey="mois" tick={{ fontSize: 12, fill: '#5A5A5A' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#8A8A7A' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E8E6DF', fontSize: 11 }} formatter={v => v != null ? v+'%' : '—'} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {CONS_NAMES.filter(n => visibleCons[n]).map((n, i) => (
                  <Line key={n} type="monotone" dataKey={n} stroke={CONS_COLORS[CONS_NAMES.indexOf(n)]} strokeWidth={2} dot={{ r: 3 }} connectNulls name={n.split(' ')[0]} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ ...S.card, marginTop: 14 }}>
            <div style={S.h3}>CV Taux de conversion 2026 — par conseillere</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {CONS_NAMES.map((n, i) => (
                <div key={n}
                  onClick={() => openPicker?.(`Taux conv. 2026 — ${n.split(' ')[0]}`, (src, data) => {})}
                  style={{ background: '#F8F7F4', borderRadius: 8, padding: '12px 16px', borderLeft: `3px solid ${CONS_COLORS[i]}`, cursor: 'pointer' }}
                  title="Cliquer pour lier à une source Supabase"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ fontSize: 12, fontWeight: 600 }}>{n.split(' ')[0]}</div>
                    <span style={{ fontSize: 10, color: '#C9A84C' }}>⟳ source</span>
                  </div>
                  {(() => {
                    const vals = MOIS_LABELS.map((m, mi) =>
                      liveData?.['cc_conv_tel_mensuel']?.[n]?.[mi] != null
                        ? Math.min(100, liveData['cc_conv_tel_mensuel'][n][mi])
                        : (CONV_TEL_MM[n]?.conv_tel[mi] != null ? Math.min(100, CONV_TEL_MM[n].conv_tel[mi]) : null)
                    ).filter(v => v != null)
                    const moy = vals.length > 0 ? parseFloat((vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1)) : null
                    return (
                      <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', marginBottom: 6 }}>
                        <div>
                          <div style={{ fontSize: 10, color: '#8A8A7A' }}>Moy. 2026</div>
                          <div style={{ fontWeight: 700, color: moy != null ? CONS_COLORS[i] : '#D0CEC7', fontSize: 20 }}>
                            {moy != null ? `${moy}%` : '—'}
                          </div>
                        </div>
                        <div>
                          <div style={{ fontSize: 10, color: '#8A8A7A' }}>CV 2026</div>
                          <CvBadge cv={CV_GLOBAL_MM_CONS[n]} small />
                        </div>
                      </div>
                    )
                  })()}
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
              <button key={n} onClick={() => setVisibleCons(p => ({ ...p, [n]: !p[n] }))} style={{
                padding: '4px 12px', borderRadius: 16,
                border: `1px solid ${visibleCons[n] ? CONS_COLORS[i] : '#E8E6DF'}`,
                background: visibleCons[n] ? CONS_COLORS[i]+'18' : '#fff',
                color: visibleCons[n] ? CONS_COLORS[i] : '#8A8A7A',
                fontSize: 11, cursor: 'pointer', fontWeight: visibleCons[n] ? 500 : 400,
              }}>{n.split(' ')[0]}</button>
            ))}
          </div>
          <div style={S.card}>
            <div style={S.h3}>Taux de conversion Avril — jour par jour</div>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={DATES_AVR.map((d, di) => {
                const row = { d: d.slice(8)+'/'+d.slice(5,7) }
                CONS_NAMES.forEach(n => {
                  const liveVal = liveData?.['cc_conv_tel_jj']?.[n]?.find(e => e?.date === d)?.val
                  const v = liveVal != null ? liveVal : (CONV_TEL_JJ[n]?.conv_tel[di] ?? null)
                  row[n] = v !== null ? Math.min(100, v) : null
                })
                return row
              })}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F0EEE9" vertical={false} />
                <XAxis dataKey="d" tick={{ fontSize: 10, fill: '#5A5A5A' }} axisLine={false} tickLine={false} interval={2} />
                <YAxis tick={{ fontSize: 11, fill: '#8A8A7A' }} axisLine={false} tickLine={false} unit="%" />
                <Tooltip contentStyle={{ borderRadius: 8, border: '1px solid #E8E6DF', fontSize: 11 }} formatter={v => v != null ? v+'%' : '—'} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {CONS_NAMES.filter(n => visibleCons[n]).map((n, i) => (
                  <Line key={n} type="monotone" dataKey={n} stroke={CONS_COLORS[CONS_NAMES.indexOf(n)]} strokeWidth={2} dot={{ r: 2 }} connectNulls name={n.split(' ')[0]} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div style={{ ...S.card, marginTop: 14 }}>
            <div style={S.h3}>CV Taux de conversion Avril — par conseillere</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
              {CONS_NAMES.map((n, i) => (
                <div key={n}
                  onClick={() => openPicker?.(`Conv. Tél. JJ ${n.split(' ')[0]}`, (src, data) => {})}
                  style={{ background: '#F8F7F4', borderRadius: 8, padding: '10px 14px', borderLeft: `3px solid ${CONS_COLORS[i]}`, cursor: 'pointer' }}
                  title="Cliquer pour lier à une source Supabase"
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <div style={{ fontSize: 12, fontWeight: 500 }}>{n.split(' ')[0]}</div>
                    <span style={{ fontSize: 10, color: '#C9A84C' }}>⟳ source</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#8A8A7A' }}>Moy. Avr</div>
                      <div style={{ fontWeight: 700, color: CONS_COLORS[i], fontSize: 15 }}>
                        {(() => {
                            const liveVals = liveData?.['cc_conv_tel_jj']?.[n]
                            if (liveVals) {
                              // Taux global = sum(RDV) / sum(echanges) via les donnees live
                              const tot = liveVals.filter(e => e?.val != null).reduce((acc, e) => ({
                                rdv: acc.rdv + (e.rdv || 0),
                                ech: acc.ech + (e.ech || 0),
                              }), { rdv: 0, ech: 0 })
                              const g = tot.ech > 0 ? parseFloat(((tot.rdv/tot.ech)*100).toFixed(1)) : null
                              return g != null ? `${g}%` : `${CONV_TEL_GLOBAL_AVR[n] ?? '—'}%`
                            }
                            return `${CONV_TEL_GLOBAL_AVR[n] ?? '—'}%`
                          })()}
                      </div>
                    </div>
                    <div><div style={{ fontSize: 10, color: '#8A8A7A' }}>CV JJ Avril</div><CvBadge cv={CV_GLOBAL_JJ_CONS[n]} small /></div>
                  </div>
                </div>
              ))}
            </div>
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
      { tier: 1, nom: 'Khalid Amghoud', tv: 22.2, delai: '1j' },
      { tier: 2, nom: 'Saad Fellah', tv: 8.7, delai: '5j' },
      { tier: 2, nom: 'Najlaa Maarouf', tv: 6.7, delai: '2j' },
      { tier: 2, nom: 'Nouhaila Belhadj', tv: 11.5, delai: '1j' },
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
  { nom: 'Khalid', tv: 22.2, cv: 181.6, tier: 'r' },
  { nom: 'Nouhaila', tv: 11.5, cv: 219.2, tier: 'v' },
  { nom: 'Saad', tv: 8.3, cv: 220.6, tier: 'v' },
  { nom: 'Abdelhak', tv: 5.8, cv: 222.3, tier: 'v' },
  { nom: 'Samia (K)', tv: 33.3, cv: 249.4, tier: 'v' },
  { nom: 'Najlaa', tv: 6.7, cv: 424.3, tier: 'tv' },
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
  { nom: 'Khalid', tv: 22.2, vtes: 6, moy: 10.1, med: 1, j3: 5, j14: 3 },
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
  { color:'#4CAF7D', titre:'Avril : meilleur mois', texte:'28 ventes operationnelles · TV% 9.4% · +108% vs Fev' },
  { color:'#C9A84C', titre:'Sale domine', texte:'24/28 ventes · TV% 9.4% vs 4.5% Kenitra · Khalid #1 (22.2%)' },
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
  { id: 'plans', label: "Plans d'actions" },
]






function PlanForm({ onSave, onCancel, label, saving }) {
  const [titre, setTitre] = React.useState('')
  return (
    <div style={{ margin: '8px 16px 12px', background: '#fff', borderRadius: 10, border: '1px solid rgba(201,168,76,0.25)', padding: 14 }}>
      <div style={{ fontSize: 10, color: '#8A8A7A', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, marginBottom: 8 }}>Nouveau plan — {label}</div>
      <input
        autoFocus
        style={{ padding: '8px 12px', border: '1px solid #E8E6DF', borderRadius: 8, fontSize: 13, color: '#2C2C2C', background: '#F8F7F4', outline: 'none', width: '100%', marginBottom: 8, boxSizing: 'border-box' }}
        placeholder="Titre du plan d'action"
        value={titre}
        onChange={e => setTitre(e.target.value)}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => onSave(titre)} disabled={saving || !titre.trim()} style={{ background: !titre.trim() ? '#E8D5A3' : '#C9A84C', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>{saving ? 'Enregistrement...' : 'Créer'}</button>
        <button onClick={onCancel} style={{ background: '#fff', color: '#5A5A5A', border: '1px solid #E8E6DF', padding: '7px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>Annuler</button>
      </div>
    </div>
  )
}

function PointForm({ onSave, onCancel, saving }) {
  const [description, setDescription] = React.useState('')
  const [responsable, setResponsable] = React.useState('')
  const [date_echeance, setDate] = React.useState('')
  const inputStyle = { padding: '8px 12px', border: '1px solid #E8E6DF', borderRadius: 8, fontSize: 13, color: '#2C2C2C', background: '#F8F7F4', outline: 'none', width: '100%', boxSizing: 'border-box' }
  return (
    <div style={{ background: '#F8F7F4', borderRadius: 8, padding: 12, border: '1px solid #E8E6DF', marginTop: 6 }}>
      <input autoFocus style={{ ...inputStyle, marginBottom: 8 }} placeholder="Description du point d'action" value={description} onChange={e => setDescription(e.target.value)}/>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
        <input style={inputStyle} placeholder="Responsable" value={responsable} onChange={e => setResponsable(e.target.value)}/>
        <input style={inputStyle} type="date" value={date_echeance} onChange={e => setDate(e.target.value)}/>
      </div>
      <div style={{ display: 'flex', gap: 6 }}>
        <button onClick={() => onSave({ description, responsable, date_echeance })} disabled={saving || !description.trim()} style={{ background: !description.trim() ? '#E8D5A3' : '#C9A84C', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' }}>Ajouter</button>
        <button onClick={onCancel} style={{ background: '#fff', color: '#5A5A5A', border: '1px solid #E8E6DF', padding: '7px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer' }}>Annuler</button>
      </div>
    </div>
  )
}

// ── Section Plans d'Actions v4 — Cartes expandables style CE ────────────────

const SEGMENTS_PA = [
  { id: 'cc', label: 'Call Center', resp: 'Nadir HADRAK', color: '#C9A84C', initial: 'N' },
  { id: 'marketing', label: 'Marketing', resp: "Mos'art", color: '#4CAF7D', initial: 'M' },
  { id: 'commercial', label: 'Commercial', resp: 'A. RHALMI / K. SNAIKI', color: '#378ADD', initial: 'A' },
]

const CONSEILLERES_CC = [
  'Equipe CC',
  'Rajaa ELKHANCHAR',
  'Fatima Zahraa AAKIBA',
  'Ghizlane ELBAKARI',
  'Hala ELAOUAD',
  'Kaoutar HRARTI',
  'Siham IBNTABET',
]

const EQUIPES_COM = [
  { id: 'equipe_sale', label: 'Équipe Sale', resp: 'Abdelhakim RHALMI', color: '#C9A84C', commerciaux: ['Abdelhak Lakouissmi','Saad Fellah','Nouhaila Belhadj','Khalid Amghoud'] },
  { id: 'equipe_kenitra', label: 'Équipe Kénitra', resp: 'Karima SNAIKI', color: '#378ADD', commerciaux: ['Ismail Hammouch','Oumaima Benali','Marouane Tazi'] },
]

const STATUTS_PA = [
  { id: 'ouvert',     label: 'Ouvert',            color: '#378ADD', bg: '#EEF4FB' },
  { id: 'en_cours',   label: 'En cours',           color: '#C9A84C', bg: '#FDF6E3' },
  { id: 'en_attente', label: 'En attente',         color: '#8A8A7A', bg: '#F0EEE8' },
  { id: 'validation', label: 'En att. validation', color: '#4CAF7D', bg: '#E6F7EF' },
  { id: 'annule',     label: 'Annulé',             color: '#E05C5C', bg: '#FEF0F0' },
  { id: 'cloture',    label: 'Clôturé',            color: '#5A5A5A', bg: '#F0EEE8' },
]

function SectionPlansActions() {
  const [plans, setPlans] = useState([])
  const [loading, setLoading] = useState(true)
  const [expandedSegs, setExpandedSegs] = useState({ cc: true })
  const [expandedCibles, setExpandedCibles] = useState({})
  const [expandedEquipes, setExpandedEquipes] = useState({})
  const [expandedPlans, setExpandedPlans] = useState({})
  const [expandedPoints, setExpandedPoints] = useState({})
  const [showPlanForm, setShowPlanForm] = useState(null) // cible_nom
  const [showPointForm, setShowPointForm] = useState(null) // plan_id
  const [formPlan, setFormPlan] = useState({ titre: '', statut: 'ouvert' })
  const [formPoint, setFormPoint] = useState({ description: '', responsable: '', date_echeance: '' })
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState(null)
  const [activeSeg, setActiveSeg] = useState('cc')

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    const { data: ps } = await supabase.from('plans_etude').select('*').eq('etude_id', 'perf_avril_2026').order('created_at')
    const result = []
    for (const p of (ps || [])) {
      const { data: pts } = await supabase.from('points_actions_etude').select('*').eq('plan_id', p.id).order('created_at')
      result.push({ ...p, points: pts || [] })
    }
    setPlans(result)
    setLoading(false)
  }

  function getPlans(segment, cibleNom) {
    return plans.filter(p => p.segment === segment && p.cible_nom === cibleNom)
  }

  function getBadge(segment, cibleNom) {
    const ps = getPlans(segment, cibleNom)
    if (!ps.length) return null
    if (ps.some(p => p.statut === 'validation')) return STATUTS_PA.find(s => s.id === 'validation')
    if (ps.some(p => p.statut === 'en_cours'))   return STATUTS_PA.find(s => s.id === 'en_cours')
    if (ps.some(p => p.statut === 'en_attente')) return STATUTS_PA.find(s => s.id === 'en_attente')
    return STATUTS_PA.find(s => s.id === 'ouvert')
  }

  function calcPct(plans) {
    const all = plans.flatMap(p => p.points)
    if (!all.length) return 0
    return Math.round(all.filter(p => ['validation','cloture'].includes(p.statut)).length / all.length * 100)
  }

  async function savePlan(segment, cibleNom, titre) {
    if (!titre || !titre.trim()) return
    setSaving(true)
    await supabase.from('plans_etude').insert({
      etude_id: 'perf_avril_2026', segment,
      cible_type: cibleNom.startsWith('equipe') || cibleNom === 'Equipe CC' ? 'equipe' : 'individuel',
      cible_nom: cibleNom, titre: titre, statut: 'ouvert'
    })
    setSaving(false)
    setShowPlanForm(null)
    // Mise à jour locale sans rechargement
    const { data: newPlan } = await supabase.from('plans_etude').select('*').eq('etude_id', 'perf_avril_2026').order('created_at').limit(1).single()
    if (newPlan) setPlans(prev => [...prev, { ...newPlan, points: [] }])
    setMsg('Plan créé !'); setTimeout(() => setMsg(null), 2500)
  }

  async function savePoint(planId, data) {
    if (!data.description.trim()) return
    setSaving(true)
    await supabase.from('points_actions_etude').insert({ plan_id: planId, ...data })
    setSaving(false); setShowPointForm(null)
    // Mise à jour locale sans rechargement
    const { data: newPt } = await supabase.from('points_actions_etude').select('*').eq('plan_id', planId).order('created_at')
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, points: newPt || [] } : p))
  }

  async function updateStatut(table, id, statut) {
    await supabase.from(table).update({ statut, updated_at: new Date().toISOString() }).eq('id', id)
    // Mise à jour locale du state
    if (table === 'plans_etude') {
      setPlans(prev => prev.map(p => p.id === id ? { ...p, statut } : p))
    } else {
      setPlans(prev => prev.map(p => ({
        ...p,
        points: p.points.map(pt => pt.id === id ? { ...pt, statut } : pt)
      })))
    }
  }

  async function deletePlan(id) {
    if (!confirm('Supprimer ce plan ?')) return
    await supabase.from('plans_etude').delete().eq('id', id)
    setPlans(prev => prev.filter(p => p.id !== id))
  }

  async function deletePoint(planId, pointId) {
    if (!confirm('Supprimer ce point ?')) return
    await supabase.from('points_actions_etude').delete().eq('id', pointId)
    setPlans(prev => prev.map(p => p.id === planId
      ? { ...p, points: p.points.filter(pt => pt.id !== pointId) }
      : p
    ))
  }

  const S = {
    card: { background: '#fff', border: '1px solid #E8E6DF', borderRadius: 12, marginBottom: 10, overflow: 'hidden' },
    input: { padding: '8px 12px', border: '1px solid #E8E6DF', borderRadius: 8, fontSize: 13, color: '#2C2C2C', background: '#F8F7F4', outline: 'none', width: '100%' },
    label: { fontSize: 10, color: '#8A8A7A', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500, marginBottom: 4, display: 'block' },
    btnPrimary: { background: '#C9A84C', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 500, cursor: 'pointer' },
    btnGhost: { background: '#fff', color: '#5A5A5A', border: '1px solid #E8E6DF', padding: '7px 16px', borderRadius: 8, fontSize: 12, cursor: 'pointer' },
    badge: (s) => { const st = STATUTS_PA.find(x => x.id === s) || STATUTS_PA[0]; return { background: st.bg, color: st.color, border: `1px solid ${st.color}33`, borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 600 } },
    smallBtn: (col, bg) => ({ background: bg, color: col, border: `1px solid ${col}33`, padding: '2px 8px', borderRadius: 5, fontSize: 11, cursor: 'pointer', fontWeight: 500 }),
    noPlan: { background: '#F0EEE8', color: '#8A8A7A', border: '1px solid #D5D2CA', borderRadius: 6, padding: '2px 8px', fontSize: 10, fontWeight: 500 },
  }

  function NoPlanBadge() {
    return <span style={S.noPlan}>Aucun plan</span>
  }

  function CibleRow({ segment, cibleNom, label, level = 0 }) {
    const ps = getPlans(segment, cibleNom)
    const badge = getBadge(segment, cibleNom)
    const isOpen = expandedCibles[`${segment}_${cibleNom}`]
    const pct = calcPct(ps)

    return (
      <div>
        {/* Header cible */}
        <div onClick={() => setExpandedCibles(p => ({ ...p, [`${segment}_${cibleNom}`]: !p[`${segment}_${cibleNom}`] }))}
          style={{ display: 'flex', alignItems: 'center', gap: 10, padding: `10px 18px 10px ${18 + level * 16}px`, cursor: 'pointer', borderBottom: '1px solid #F0EEE9', background: isOpen ? '#FAFAF8' : '#fff', transition: 'background 0.1s' }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: badge ? badge.color : '#D5D2CA', flexShrink: 0 }}/>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, color: '#2C2C2C', fontWeight: badge ? 500 : 400 }}>{label}</div>
            {ps.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3 }}>
                <div style={{ width: 60, height: 3, background: '#F0EEE8', borderRadius: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: pct + '%', background: pct >= 80 ? '#4CAF7D' : '#C9A84C', borderRadius: 2 }}/>
                </div>
                <span style={{ fontSize: 10, color: '#8A8A7A' }}>{ps.length} plan{ps.length > 1 ? 's' : ''} · {pct}%</span>
              </div>
            )}
          </div>
          {badge ? <span style={S.badge(badge.id)}>{badge.label}</span> : <NoPlanBadge/>}
          <span style={{ fontSize: 9, color: '#8A8A7A', transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
        </div>

        {/* Corps cible */}
        {isOpen && (
          <div style={{ background: '#F8F7F4', borderBottom: '1px solid #F0EEE9' }}>
            {/* Plans existants */}
            {ps.map(plan => {
              const isPlanOpen = expandedPlans[plan.id]
              const st = STATUTS_PA.find(s => s.id === plan.statut) || STATUTS_PA[0]
              return (
                <div key={plan.id} style={{ margin: '8px 16px', background: '#fff', border: '1px solid #E8E6DF', borderRadius: 10, overflow: 'hidden', borderLeft: `3px solid ${st.color}` }}>
                  {/* Plan header */}
                  <div onClick={() => setExpandedPlans(p => ({ ...p, [plan.id]: !p[plan.id] }))}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', cursor: 'pointer', background: isPlanOpen ? '#FAFAF8' : '#fff' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2C' }}>{plan.titre}</div>
                      <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 2 }}>{plan.points.length} point{plan.points.length !== 1 ? 's' : ''}</div>
                    </div>
                    <span style={S.badge(plan.statut)}>{st.label}</span>
                    <button onClick={e => { e.stopPropagation(); deletePlan(plan.id) }} style={{ background: 'none', border: 'none', color: '#D5D2CA', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>×</button>
                    <span style={{ fontSize: 9, color: '#8A8A7A', transition: 'transform 0.2s', transform: isPlanOpen ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
                  </div>

                  {/* Points */}
                  {isPlanOpen && (
                    <div style={{ padding: '8px 14px 12px', borderTop: '1px solid #F0EEE9' }}>
                      {plan.points.map(pt => {
                        const spt = STATUTS_PA.find(s => s.id === pt.statut) || STATUTS_PA[0]
                        const isPtOpen = expandedPoints[pt.id]
                        return (
                          <div key={pt.id} style={{ marginBottom: 6, border: '1px solid #F0EEE9', borderRadius: 8, overflow: 'hidden' }}>
                            <div onClick={() => setExpandedPoints(p => ({ ...p, [pt.id]: !p[pt.id] }))}
                              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', cursor: 'pointer', background: isPtOpen ? '#FAFAF8' : '#fff' }}>
                              <div style={{ width: 6, height: 6, borderRadius: '50%', background: spt.color, flexShrink: 0 }}/>
                              <span style={{ flex: 1, fontSize: 12, color: '#2C2C2C' }}>{pt.description.length > 55 ? pt.description.substring(0,55)+'…' : pt.description}</span>
                              <span style={S.badge(pt.statut)}>{spt.label}</span>
                              <button onClick={e => { e.stopPropagation(); deletePoint(plan.id, pt.id) }} style={{ background: 'none', border: 'none', color: '#D5D2CA', cursor: 'pointer', fontSize: 14, padding: '0 4px' }}>×</button>
                              <span style={{ fontSize: 8, color: '#8A8A7A' }}>{isPtOpen ? '▲' : '▼'}</span>
                            </div>
                            {isPtOpen && (
                              <div style={{ padding: '10px 12px', borderTop: '1px solid #F0EEE9' }}>
                                <div style={{ fontSize: 12, color: '#2C2C2C', marginBottom: 6, lineHeight: 1.5 }}>{pt.description}</div>
                                <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
                                  {pt.responsable && <span style={{ fontSize: 11, color: '#8A8A7A' }}>Resp : {pt.responsable}</span>}
                                  {pt.date_echeance && <span style={{ fontSize: 11, color: '#8A8A7A' }}>Échéance : {new Date(pt.date_echeance).toLocaleDateString('fr-FR')}</span>}
                                </div>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  {!['validation','cloture'].includes(pt.statut) && <button style={S.smallBtn('#4CAF7D','#E6F7EF')} onClick={() => updateStatut('points_actions_etude', pt.id, 'validation')}>Valider</button>}
                                  {['ouvert','en_cours'].includes(pt.statut) && <button style={S.smallBtn('#8A8A7A','#F0EEE8')} onClick={() => updateStatut('points_actions_etude', pt.id, 'en_attente')}>Suspendre</button>}
                                  {pt.statut !== 'cloture' && <button style={S.smallBtn('#C9A84C','#FDF6E3')} onClick={() => updateStatut('points_actions_etude', pt.id, 'cloture')}>Clôturer</button>}
                                  <button style={S.smallBtn('#8A8A7A','#F0EEE8')} onClick={() => updateStatut('points_actions_etude', pt.id, 'annule')}>Archiver</button>
                                </div>
                              </div>
                            )}
                          </div>
                        )
                      })}

                      {/* Form point */}
                      {showPointForm === plan.id ? (
                        <PointForm
                          key={`pt-form-${plan.id}`}
                          saving={saving}
                          onSave={(data) => savePoint(plan.id, data)}
                          onCancel={() => setShowPointForm(null)}
                        />
                      ) : (
                        <button onClick={() => setShowPointForm(plan.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', border: '1px dashed #E8E6DF', borderRadius: 8, cursor: 'pointer', color: '#8A8A7A', fontSize: 12, background: 'transparent', marginTop: 6 }}>
                          + Ajouter un point
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )
            })}

            {/* Form nouveau plan */}
            {showPlanForm === `${segment}_${cibleNom}` ? (
              <PlanForm
                key={`plan-form-${segment}-${cibleNom}`}
                label={label}
                saving={saving}
                onSave={(titre) => savePlan(segment, cibleNom, titre)}
                onCancel={() => setShowPlanForm(null)}
              />
            ) : (
              <button onClick={() => setShowPlanForm(`${segment}_${cibleNom}`)} style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 16px 12px', padding: '6px 12px', border: '1px dashed rgba(201,168,76,0.3)', borderRadius: 8, cursor: 'pointer', color: '#C9A84C', fontSize: 12, background: 'transparent' }}>
                + Nouveau plan pour {label}
              </button>
            )}
          </div>
        )}
      </div>
    )
  }

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: '#8A8A7A', fontSize: 13 }}>Chargement...</div>

  // Compter les plans par segment
  const countSeg = (seg) => plans.filter(p => p.segment === seg).length

  return (
    <div>
      {msg && <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 14, fontSize: 13, background: '#E6F7EF', color: '#2d7a54', border: '1px solid #4CAF7D33' }}>{msg}</div>}

      {/* ── Call Center ── */}
      <div style={S.card}>
        <div onClick={() => setExpandedSegs(p => ({ ...p, cc: !p.cc }))}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer', borderLeft: '4px solid #C9A84C', background: expandedSegs.cc ? '#FAFAF8' : '#fff' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(201,168,76,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: '#8A6820', flexShrink: 0 }}>N</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#2C2C2C' }}>Call Center</div>
            <div style={{ fontSize: 12, color: '#8A8A7A', marginTop: 2 }}>Nadir HADRAK · {CONSEILLERES_CC.length} cibles</div>
          </div>
          {countSeg('cc') > 0 ? <span style={{ fontSize: 12, color: '#C9A84C', fontWeight: 500 }}>{countSeg('cc')} plan{countSeg('cc') > 1 ? 's' : ''}</span> : <span style={S.noPlan}>Aucun plan</span>}
          <span style={{ fontSize: 10, color: '#8A8A7A', transition: 'transform 0.2s', transform: expandedSegs.cc ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
        </div>
        {expandedSegs.cc && (
          <div style={{ borderTop: '1px solid #E8E6DF' }}>
            {CONSEILLERES_CC.map(c => <CibleRow key={c} segment="cc" cibleNom={c} label={c}/>)}
          </div>
        )}
      </div>

      {/* ── Marketing ── */}
      <div style={S.card}>
        <div onClick={() => setExpandedSegs(p => ({ ...p, mkt: !p.mkt }))}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer', borderLeft: '4px solid #4CAF7D', background: expandedSegs.mkt ? '#FAFAF8' : '#fff' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(76,175,125,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: '#2d7a54', flexShrink: 0 }}>M</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#2C2C2C' }}>Marketing</div>
            <div style={{ fontSize: 12, color: '#8A8A7A', marginTop: 2 }}>Mos'art · 1 cible</div>
          </div>
          {countSeg('marketing') > 0 ? <span style={{ fontSize: 12, color: '#4CAF7D', fontWeight: 500 }}>{countSeg('marketing')} plan{countSeg('marketing') > 1 ? 's' : ''}</span> : <span style={S.noPlan}>Aucun plan</span>}
          <span style={{ fontSize: 10, color: '#8A8A7A', transition: 'transform 0.2s', transform: expandedSegs.mkt ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
        </div>
        {expandedSegs.mkt && (
          <div style={{ borderTop: '1px solid #E8E6DF' }}>
            <CibleRow segment="marketing" cibleNom="equipe_marketing" label="Équipe Marketing"/>
          </div>
        )}
      </div>

      {/* ── Commercial ── */}
      <div style={S.card}>
        <div onClick={() => setExpandedSegs(p => ({ ...p, com: !p.com }))}
          style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', cursor: 'pointer', borderLeft: '4px solid #378ADD', background: expandedSegs.com ? '#FAFAF8' : '#fff' }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'rgba(55,138,221,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500, color: '#185FA5', flexShrink: 0 }}>A</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#2C2C2C' }}>Commercial</div>
            <div style={{ fontSize: 12, color: '#8A8A7A', marginTop: 2 }}>2 équipes · {EQUIPES_COM.reduce((s,e) => s+e.commerciaux.length, 0)} commerciaux</div>
          </div>
          {countSeg('commercial') > 0 ? <span style={{ fontSize: 12, color: '#378ADD', fontWeight: 500 }}>{countSeg('commercial')} plan{countSeg('commercial') > 1 ? 's' : ''}</span> : <span style={S.noPlan}>Aucun plan</span>}
          <span style={{ fontSize: 10, color: '#8A8A7A', transition: 'transform 0.2s', transform: expandedSegs.com ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
        </div>
        {expandedSegs.com && (
          <div style={{ borderTop: '1px solid #E8E6DF' }}>
            {EQUIPES_COM.map(eq => (
              <div key={eq.id}>
                {/* Sous-header équipe */}
                <div onClick={() => setExpandedEquipes(p => ({ ...p, [eq.id]: !p[eq.id] }))}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 18px', cursor: 'pointer', background: expandedEquipes[eq.id] ? '#FAFAF8' : 'rgba(248,247,244,0.5)', borderBottom: '1px solid #F0EEE9', borderLeft: `3px solid ${eq.color}` }}>
                  <div style={{ width: 26, height: 26, borderRadius: '50%', background: `rgba(${eq.color === '#C9A84C' ? '201,168,76' : '55,138,221'},0.1)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 500, color: eq.color, flexShrink: 0 }}>
                    {eq.label.charAt(8)}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#2C2C2C' }}>{eq.label}</div>
                    <div style={{ fontSize: 11, color: '#8A8A7A', marginTop: 1 }}>{eq.resp}</div>
                  </div>
                  <span style={{ fontSize: 10, color: '#8A8A7A', transition: 'transform 0.2s', transform: expandedEquipes[eq.id] ? 'rotate(180deg)' : 'rotate(0)' }}>▼</span>
                </div>

                {/* Cibles équipe + commerciaux */}
                {expandedEquipes[eq.id] && (
                  <div>
                    <CibleRow segment="commercial" cibleNom={eq.id} label={eq.label} level={1}/>
                    {eq.commerciaux.map(c => <CibleRow key={c} segment="commercial" cibleNom={c} label={c} level={1}/>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default function EtudeCommerciale2026() {
  const navigate = useNavigate()
  const [active, setActive] = useState('marketing')
  // Live data overrides depuis Supabase
  const [liveData, setLiveData] = useState(() => {
    try {
      const saved = localStorage.getItem('etude_commerciale_2026_livedata')
      return saved ? JSON.parse(saved) : {}
    } catch { return {} }
  })
  const [picker, setPicker] = useState(null) // { targetLabel, onApply }

  function openPicker(targetLabel, onApply) {
    setPicker({ targetLabel, onApply })
  }

  function handleApply(source, preview) {
    setLiveData(prev => {
      const next = { ...prev, [source.id]: preview }
      try { localStorage.setItem('etude_commerciale_2026_livedata', JSON.stringify(next)) } catch {}
      return next
    })
    setPicker(null)
  }

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <button onClick={() => navigate('/etudes')} style={{ background: 'none', border: 'none', color: '#8A8A7A', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 6 }}>
            &larr; Retour aux etudes
          </button>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#2C2C2C', margin: 0 }}>Etude de la Performance Commerciale</h1>
          <div style={{ fontSize: 12, color: '#8A8A7A', marginTop: 3 }}>Avril 2026 · Sale + Kenitra · Lecture seule</div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {[{v:28,l:'Ventes Avr'},{v:'4',l:'Mois'},{v:'2',l:'Equipes'}].map(k=>(
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
      {active === 'perf' && <SectionPerfComm openPicker={openPicker} liveData={liveData} />}
      {active === 'conseilleres' && <SectionEffConseillere openPicker={openPicker} liveData={liveData} />}
      {active === 'segmentation' && <SectionSegmentation />}
      {active === 'cohorte' && <SectionCohorte />}
      {active === 'synthese' && <SectionSynthese />}
      {active === 'plans' && <SectionPlansActions />}

      {picker && (
        <EtudeSourcePicker
          targetLabel={picker.targetLabel}
          onClose={() => setPicker(null)}
          onApply={handleApply}
        />
      )}
    </div>
  )
}