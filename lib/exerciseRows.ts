type ExerciseRow = {
  name: string
  sets: number | null
  reps: number | null
  weight: number | null
}

/** Combine adjacent, equivalent rows for display while preserving exercise order. */
export function groupExerciseRows<T extends ExerciseRow>(exercises: readonly T[]): T[] {
  const rows: T[] = []
  for (const exercise of exercises) {
    const previous = rows[rows.length - 1]
    if (
      previous &&
      previous.name === exercise.name &&
      previous.reps === exercise.reps &&
      previous.weight === exercise.weight &&
      previous.sets != null &&
      exercise.sets != null &&
      exercise.reps != null
    ) {
      previous.sets += exercise.sets
    } else {
      rows.push({ ...exercise })
    }
  }
  return rows
}
