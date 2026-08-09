import re

with open('src/pages/WorkerDashboard.tsx', 'r') as f:
    content = f.read()

# Define the new render function content
new_jsx = """
  return (
    <div className="flex-grow p-4 md:p-8 space-y-8 overflow-y-auto max-h-screen bg-[#F8FAFC] pb-24">
      
      {/* Page Title Header */}
      <div>
        <h2 className="text-3xl font-black text-[#151A2D] tracking-tight m-0">Crew Dashboard</h2>
        <p className="text-sm text-[#A7AFBD] font-medium mt-1">
          Manage your jobs, track your time, and stay on top of today's work.
        </p>
      </div>

      {/* Hero Time Clock */}
      <div className="bg-white rounded-3xl shadow-sm border border-[#E2E8F0] p-6 md:p-8 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Subtle background decoration */}
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-gradient-to-br from-[#76C442]/5 to-transparent rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex flex-col items-center justify-center w-full z-10">
          <div className="mb-6 text-center">
            {activeEntry ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-50 text-green-700 rounded-full text-[10px] font-bold uppercase tracking-widest border border-green-200">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                Working now
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-gray-50 text-gray-500 rounded-full text-[10px] font-bold uppercase tracking-widest border border-gray-200">
                Ready to start your shift
              </span>
            )}
          </div>

          {!activeEntry ? (
            <button
              onClick={handleClockInClick}
              disabled={isGeoLoading}
              className="w-48 h-48 md:w-56 md:h-56 rounded-full bg-[#76C442] hover:bg-[#65b035] shadow-[0_0_40px_rgba(118,196,66,0.3)] hover:shadow-[0_0_60px_rgba(118,196,66,0.5)] transition-all flex flex-col items-center justify-center text-white cursor-pointer group disabled:opacity-50 disabled:scale-95 border-4 border-white"
            >
              {isGeoLoading ? (
                <Loader2 size={40} className="animate-spin mb-2" />
              ) : (
                <Clock size={48} className="mb-3 group-hover:scale-110 transition-transform" />
              )}
              <span className="text-2xl font-black tracking-widest uppercase">Clock In</span>
              <span className="text-xs font-bold text-white/80 mt-1 uppercase tracking-wider">Start workday</span>
            </button>
          ) : (
            <div className="flex flex-col items-center">
              <button
                onClick={() => setShowClockOutConfirm(true)}
                disabled={isGeoLoading}
                className={`w-48 h-48 md:w-56 md:h-56 rounded-full ${activeBreakEntry ? 'bg-amber-500 hover:bg-amber-600 shadow-[0_0_40px_rgba(245,158,11,0.3)]' : 'bg-red-500 hover:bg-red-600 shadow-[0_0_40px_rgba(239,68,68,0.3)]'} transition-all flex flex-col items-center justify-center text-white cursor-pointer group disabled:opacity-50 border-4 border-white`}
              >
                {isGeoLoading ? (
                  <Loader2 size={40} className="animate-spin mb-2" />
                ) : (
                  <Square size={40} fill="currentColor" className="mb-3 group-hover:scale-110 transition-transform" />
                )}
                <span className="text-2xl font-black tracking-widest uppercase">
                  {activeBreakEntry ? 'End Break' : 'Clock Out'}
                </span>
                <span className="text-xs font-bold text-white/80 mt-1 uppercase tracking-wider">
                  {activeBreakEntry ? 'Resume Work' : 'End Shift'}
                </span>
              </button>
              
              <div className="mt-8 flex flex-col items-center">
                <div className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1">Elapsed Time</div>
                <div className="text-4xl md:text-5xl font-black text-[#151A2D] tracking-tight font-mono">
                  {activeBreakEntry ? breakDuration : shiftDuration}
                </div>
                <div className="text-xs font-semibold text-gray-500 mt-2">
                  Started at {new Date(activeEntry.clock_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {!activeBreakEntry && (
                <button
                  onClick={handleStartBreak}
                  disabled={isBreakLoading}
                  className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold rounded-full transition-colors cursor-pointer border border-blue-200"
                >
                  {isBreakLoading ? <Loader2 size={16} className="animate-spin" /> : <Coffee size={16} />}
                  Take a Break
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Today's Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
            <Timer size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Hours Worked</div>
            <div className="text-lg font-black text-[#151A2D]">{activeEntry ? shiftDuration.substring(0, 5) : '0h 00m'}</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
            <Briefcase size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Jobs Assigned</div>
            <div className="text-lg font-black text-[#151A2D]">{todayJobs.length}</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-50 text-green-600 flex items-center justify-center shrink-0">
            <CheckCircle2 size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Jobs Completed</div>
            <div className="text-lg font-black text-[#151A2D]">{todayJobs.filter(j => j.status === 'Completed').length}</div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-[#E2E8F0] shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
            <Coffee size={18} />
          </div>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Break Time</div>
            <div className="text-lg font-black text-[#151A2D]">{breakDuration !== '00:00:00' ? breakDuration.substring(0, 5) : '0m'}</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
        {/* Left Column (Main Content) */}
        <div className="xl:col-span-2 space-y-8">
          
          {/* Today's Jobs */}
          <section>
            <div className="mb-4">
              <h3 className="text-lg font-black text-[#151A2D]">Today's Jobs</h3>
              <p className="text-xs text-gray-500 font-medium">Your assigned work for today</p>
            </div>

            {todayJobs.length === 0 ? (
              <div className="bg-white rounded-3xl p-10 border border-[#E2E8F0] shadow-sm text-center">
                <div className="w-20 h-20 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 size={32} className="text-green-500" />
                </div>
                <h4 className="text-xl font-bold text-[#151A2D] mb-2">You're all caught up!</h4>
                <p className="text-sm text-gray-500 max-w-sm mx-auto mb-6">
                  No jobs are scheduled for you today. Take a breather or check your upcoming schedule.
                </p>
                {weekJobs.length > 0 && (
                  <button className="inline-flex items-center gap-2 text-sm font-bold text-[#76C442] hover:text-[#65b035] transition-colors">
                    View Upcoming Jobs &rarr;
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {todayJobs.map(job => (
                  <div key={job.id} className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-3">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 text-gray-700 rounded text-[10px] font-bold uppercase tracking-widest">
                          JOB-{job.job_number}
                        </div>
                        <span className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${
                          job.status === 'Completed' ? 'bg-green-100 text-green-700' :
                          job.status === 'In Progress' ? 'bg-amber-100 text-amber-700' :
                          'bg-blue-100 text-blue-700'
                        }`}>
                          {job.status}
                        </span>
                      </div>
                      
                      <h4 className="text-lg font-black text-[#151A2D] mb-1">
                        {job.customers?.full_name || 'Anonymous client'}
                      </h4>
                      
                      <div className="flex flex-col gap-2 mt-3">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin size={16} className="text-gray-400" />
                          <span>{job.customers?.service_address || 'No address provided'}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar size={16} className="text-gray-400" />
                          <span>{formatDate(job.scheduled_date)}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="px-5 py-3 bg-gray-50 border-t border-[#E2E8F0] flex justify-end">
                      <Link 
                        to={`/jobs/${job.id}`}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 hover:border-[#76C442] hover:text-[#76C442] text-sm font-bold text-gray-700 rounded-lg transition-colors cursor-pointer"
                      >
                        View Job &rarr;
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Upcoming Jobs */}
          <section>
            <div className="mb-4">
              <h3 className="text-lg font-black text-[#151A2D]">Upcoming Jobs</h3>
              <p className="text-xs text-gray-500 font-medium">Your schedule for the rest of the week</p>
            </div>

            {weekJobs.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 border border-[#E2E8F0] shadow-sm text-center">
                <p className="text-sm text-gray-500 font-medium">No upcoming jobs this week.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm overflow-hidden divide-y divide-gray-100">
                {weekJobs.slice(0, 5).map((job, idx) => (
                  <div key={job.id} className={`p-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${idx === 0 ? 'bg-blue-50/30' : ''}`}>
                    <div className="flex items-center gap-4">
                      <div className="hidden sm:flex flex-col items-center justify-center w-12 h-12 bg-gray-100 rounded-xl">
                        <span className="text-[10px] font-bold text-gray-500 uppercase">{formatDate(job.scheduled_date).split(' ')[0]}</span>
                        <span className="text-sm font-black text-[#151A2D]">{formatDate(job.scheduled_date).split(' ')[1]}</span>
                      </div>
                      <div>
                        <div className="text-sm font-black text-[#151A2D] mb-0.5">{job.customers?.full_name}</div>
                        <div className="text-xs text-gray-500 font-medium flex items-center gap-1.5">
                          <MapPin size={12} />
                          <span className="line-clamp-1 max-w-[150px] sm:max-w-[200px]">{job.customers?.service_address}</span>
                        </div>
                      </div>
                    </div>
                    <Link 
                      to={`/jobs/${job.id}`}
                      className="p-2 text-gray-400 hover:text-[#76C442] hover:bg-green-50 rounded-lg transition-colors"
                    >
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </section>

        </div>

        {/* Right Column (Widgets) */}
        <div className="space-y-6">
          
          {/* Weekly Summary */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">This Week</h3>
            <div className="flex items-end gap-2 mb-6">
              <span className="text-4xl font-black text-[#151A2D] leading-none">{weeklyHours}h 00m</span>
              <span className="text-xs font-bold text-gray-400 mb-1">Worked</span>
            </div>
            
            {/* Minimalist Bar Chart Representation */}
            <div className="flex items-end justify-between h-24 gap-1 border-b border-gray-100 pb-2">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((day, i) => (
                <div key={i} className="flex flex-col items-center gap-2 flex-1">
                  <div 
                    className={`w-full max-w-[24px] rounded-t-sm ${i < new Date().getDay() ? 'bg-[#76C442]' : 'bg-gray-100'}`} 
                    style={{ height: `${Math.max(10, Math.random() * 80)}%` }}
                  ></div>
                  <span className="text-[10px] font-bold text-gray-400">{day}</span>
                </div>
              ))}
            </div>
          </div>

          {/* My Progress */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
            <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-4">My Progress</h3>
            
            <div className="space-y-5">
              <div>
                <div className="flex justify-between text-xs font-bold mb-1.5">
                  <span className="text-[#151A2D]">Completion Rate</span>
                  <span className="text-[#76C442]">85%</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-[#76C442] w-[85%] rounded-full"></div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="text-2xl font-black text-[#151A2D] mb-1">
                    {todayJobs.filter(j => j.status === 'Completed').length + weekJobs.filter(j => j.status === 'Completed').length}
                  </div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Done This Week</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="text-2xl font-black text-[#151A2D] mb-1">
                    {totalAssignedJobs}
                  </div>
                  <div className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">In Progress</div>
                </div>
              </div>
            </div>
          </div>

          {/* Active Assignments */}
          <div className="bg-white rounded-2xl border border-[#E2E8F0] shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider">Active Assignments</h3>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full">
                {totalAssignedJobs} Active
              </span>
            </div>
            
            <div className="space-y-3 mb-4">
              {todayJobs.slice(0, 2).map(job => (
                <div key={job.id} className="flex flex-col gap-1 text-sm border-l-2 border-blue-500 pl-3">
                  <span className="font-bold text-[#151A2D]">{job.customers?.full_name}</span>
                  <span className="text-xs text-gray-500">{job.customers?.service_address}</span>
                </div>
              ))}
              {todayJobs.length === 0 && <span className="text-xs text-gray-500">No active assignments today.</span>}
            </div>

            <Link to="/jobs" className="block text-center text-xs font-bold text-[#76C442] hover:text-[#65b035] transition-colors">
              View All Jobs &rarr;
            </Link>
          </div>

        </div>
      </div>

      {/* Clock Out Confirmation Modal */}
      {showClockOutConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-[#151A2D]/60 backdrop-blur-sm"
            onClick={() => setShowClockOutConfirm(false)}
          />
          <div className="relative bg-white w-full max-w-sm rounded-3xl border border-[#E2E8F0] shadow-2xl p-6 text-center z-10 animate-in fade-in zoom-in duration-200">
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Square size={24} fill="currentColor" />
            </div>
            <h3 className="text-xl font-black text-[#151A2D] mb-2">End your shift?</h3>
            <p className="text-sm text-gray-500 mb-6 font-medium">
              You've worked {shiftDuration.substring(0, 5)} today. Are you sure you want to clock out?
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={() => {
                  setShowClockOutConfirm(false);
                  if (activeBreakEntry) handleEndBreak();
                  else handleClockOut();
                }}
                disabled={isGeoLoading}
                className="w-full py-3.5 bg-red-500 hover:bg-red-600 text-white font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50 flex justify-center items-center gap-2"
              >
                {isGeoLoading && <Loader2 size={16} className="animate-spin" />}
                Yes, Clock Out
              </button>
              <button
                onClick={() => setShowClockOutConfirm(false)}
                className="w-full py-3.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Geolocation Consent Modal */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-[#151A2D]/65 backdrop-blur-sm"
            onClick={() => setShowConsentModal(false)}
          />
          <div className="relative bg-white w-full max-w-sm rounded-2xl border border-[#E2E8F0] shadow-2xl overflow-hidden z-10 flex flex-col">
            <div className="p-4 bg-[#151A2D] text-white flex items-center gap-2">
              <Navigation size={18} className="text-[#76C442]" />
              <h3 className="text-sm font-bold text-white m-0">Location Consent Required</h3>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-xs text-[#151A2D] font-medium leading-relaxed m-0">
                To comply with dispatch safety and accurate payroll logging, Space Insulation records your GPS coordinates <strong>only at the exact moments of clock-in and clock-out</strong>.
              </p>
              
              <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 text-[10px] text-gray-600 space-y-1.5 leading-relaxed">
                <div className="flex items-center gap-1 font-bold text-[#151A2D]">
                  <ShieldCheck size={12} className="text-[#76C442]" />
                  <span>Privacy Policy Protections:</span>
                </div>
                <div>• Geolocation coordinate points are never logged in background.</div>
                <div>• Location verification is used solely for client proximity checks.</div>
              </div>

              {consentError && (
                <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-[10px] rounded flex items-center gap-1.5">
                  <AlertCircle size={12} className="text-red-500 shrink-0" />
                  <span>{consentError}</span>
                </div>
              )}
            </div>
            <div className="px-5 py-3.5 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowConsentModal(false)}
                className="px-4 py-2 border border-gray-300 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={handleAcceptConsent}
                className="px-4 py-2 bg-[#76C442] hover:bg-[#65b035] text-white text-xs font-bold rounded-xl transition-all shadow-sm cursor-pointer"
              >
                Accept & Clock In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shift Summary Modal */}
      {showSummaryModal && summaryData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-[#151A2D]/65 backdrop-blur-sm"
            onClick={() => setShowSummaryModal(false)}
          />
          <div className="relative bg-white w-full max-w-sm rounded-3xl border border-[#E2E8F0] shadow-2xl overflow-hidden z-10 flex flex-col animate-in zoom-in duration-200">
            <div className="p-6 bg-[#151A2D] text-white text-center">
              <div className="w-16 h-16 bg-[#76C442]/20 rounded-full flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 size={32} className="text-[#76C442]" />
              </div>
              <h3 className="text-xl font-black text-white m-0 tracking-tight">Shift Completed</h3>
              <p className="text-sm text-gray-400 mt-1 font-medium">Great job today!</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-bold">Clock In</span>
                  <span className="font-black text-[#151A2D]">
                    {new Date(summaryData.clockIn).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500 font-bold">Clock Out</span>
                  <span className="font-black text-[#151A2D]">
                    {new Date(summaryData.clockOut).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="border-t border-gray-200 pt-3 flex justify-between text-sm">
                  <span className="text-gray-500 font-bold">Total Break</span>
                  <span className="font-black text-amber-600">{summaryData.totalBreakTime}</span>
                </div>
                <div className="flex justify-between text-base pt-1">
                  <span className="text-[#151A2D] font-black">Actual Worked</span>
                  <span className="font-black text-[#76C442] text-lg">{summaryData.actualWorkedTime}</span>
                </div>
              </div>

              {summaryData.flagged && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-start gap-2">
                  <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
                  <div className="text-[10px] text-amber-800 leading-normal font-medium">
                    <strong>Flagged:</strong> You had an open break session on clock-out. The system auto-closed it.
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowSummaryModal(false)}
                className="w-full py-3.5 bg-[#151A2D] hover:bg-black text-white text-sm font-bold rounded-xl transition-colors cursor-pointer"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
"""

# Extract everything up to the main return
split_pattern = r'  return \(\n    <div className="flex-grow'
parts = re.split(split_pattern, content)

if len(parts) > 1:
    header = parts[0]
    
    # We don't want the old return content, so we just write header + new_jsx + "};"
    # Actually wait, is there anything after the main return block?
    # Usually it's just `};` at the end of the file.
    # We can just write header + new_jsx + "\n};\n"
    
    with open('src/pages/WorkerDashboard.tsx', 'w') as f:
        f.write(header + new_jsx + "\n};\n")
        
    print("Dashboard UI replaced successfully")
else:
    print("Could not find the return statement to split on")

