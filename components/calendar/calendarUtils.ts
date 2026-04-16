export interface CalDay { date: Date; isToday: boolean; isCurrentMonth: boolean; }

export function getMonthGrid(year: number, month: number): CalDay[] {
  const today=new Date(), firstDay=new Date(year,month,1), lastDay=new Date(year,month+1,0);
  const startOffset=(firstDay.getDay()+6)%7, endOffset=(7-((lastDay.getDay()+1)%7))%7;
  const days: CalDay[] = [];
  for(let i=startOffset;i>0;i--) days.push({date:new Date(year,month,1-i),isToday:false,isCurrentMonth:false});
  for(let d=1;d<=lastDay.getDate();d++){const date=new Date(year,month,d);days.push({date,isToday:isSameDay(date,today),isCurrentMonth:true});}
  for(let i=1;i<=endOffset;i++) days.push({date:new Date(year,month+1,i),isToday:false,isCurrentMonth:false});
  return days;
}

export function getWeekDays(anchor: Date): CalDay[] {
  const today=new Date(), monday=getMonday(anchor);
  return Array.from({length:7},(_,i)=>{const date=new Date(monday);date.setDate(monday.getDate()+i);return{date,isToday:isSameDay(date,today),isCurrentMonth:true};});
}

export function getMonday(date: Date): Date { const d=new Date(date),day=(d.getDay()+6)%7;d.setDate(d.getDate()-day);d.setHours(0,0,0,0);return d; }
export function isSameDay(a: Date, b: Date): boolean { return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate(); }
export function formatMonthLabel(year: number, month: number) { return new Date(year,month,1).toLocaleDateString('de-DE',{month:'long',year:'numeric'}); }
export function formatWeekLabel(anchor: Date) { const mon=getMonday(anchor),sun=new Date(mon);sun.setDate(mon.getDate()+6);const o: Intl.DateTimeFormatOptions={day:'2-digit',month:'short'};return`${mon.toLocaleDateString('de-DE',o)} – ${sun.toLocaleDateString('de-DE',o)}`; }
export function formatTime(iso: string) { return new Date(iso).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}); }
export const WEEKDAY_LABELS = ['Mo','Di','Mi','Do','Fr','Sa','So'];
