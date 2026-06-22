interface LoadingStateProps {
  message?: string
}

export function LoadingState({ message = '正在思考吃什么…' }: LoadingStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-20">
      <div className="relative h-16 w-16">
        <div className="absolute inset-0 animate-ping rounded-full bg-brand-200 opacity-40" />
        <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 text-3xl">
          🍜
        </div>
      </div>
      <p className="text-stone-600">{message}</p>
    </div>
  )
}
